-- §7 feed ranking, §5 friend visibility functions, chat cap, invites.

create or replace function public.haversine_miles(lat1 double precision, lng1 double precision,
                                                  lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe as $$
  select 3958.8 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Visible friends of a user: accepted friendship, owner shares saves. Internal helper.
create or replace function public.friend_ids(p_user uuid)
returns table (fid uuid) language sql stable security definer set search_path = public as $$
  select case when f.requester_id = p_user then f.addressee_id else f.requester_id end
  from friendships f
  where f.status = 'accepted' and p_user in (f.requester_id, f.addressee_id);
$$;
revoke execute on function public.friend_ids(uuid) from public, anon, authenticated;

-- ---------- get_feed (§7) ----------
-- Keyset pagination on (score, id). Pass back {"score","id","asof"} from the last row as p_cursor.
-- `asof` freezes the time-based terms across pages, and items first seen during this feed session
-- are excluded from later pages, so pages don't overlap. Swipes that change tag weights mid-session
-- can still shift scores slightly; the client de-dupes by id.
-- The "random" term is a per-user, per-listing, per-day hash so it is stable across pages.
create or replace function public.get_feed(p_user uuid, p_limit int default 15, p_cursor jsonb default null)
returns table (
  id uuid, url text, title text, org_name text, org_logo_url text, type opp_type,
  description text, summary text, tags text[], location_text text, is_remote boolean,
  grade_min int, grade_max int, eligibility_text text,
  deadline timestamptz, starts_at timestamptz, ends_at timestamptz,
  compensation_text text, amount_usd numeric, image_url text, image_alt text,
  created_at timestamptz, score double precision, asof timestamptz,
  friends_saved_count int, friends_saved jsonb
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  me profiles%rowtype;
  v_asof timestamptz := coalesce((p_cursor ->> 'asof')::timestamptz, now());
  c_score double precision := (p_cursor ->> 'score')::double precision;
  c_id uuid := (p_cursor ->> 'id')::uuid;
begin
  if p_user is distinct from auth.uid() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'get_feed: not allowed' using errcode = '42501';
  end if;
  select * into me from profiles where profiles.id = p_user;

  return query
  with
  friend_saves_agg as (
    select ul.listing_id,
           count(*)::int as cnt,
           to_jsonb((array_agg(
             jsonb_build_object('id', p.id, 'username', p.username,
                                'display_name', p.display_name, 'avatar_url', p.avatar_url)
             order by ul.decided_at desc nulls last))[1:3]) as people
    from user_listings ul
    join public.friend_ids(p_user) fr on fr.fid = ul.user_id
    join profiles p on p.id = ul.user_id
    where ul.state = 'saved' and not ul.hidden_from_friends and p.share_saves
    group by ul.listing_id
  ),
  candidates as (
    select l.*, ul.state as my_state, ul.seen_at as my_seen_at
    from listings l
    left join user_listings ul on ul.user_id = p_user and ul.listing_id = l.id
    where l.status = 'active'
      and l.enriched
      and (l.deadline is null or l.deadline > v_asof)
      and (ul.state is null or ul.state = 'seen')
      and (me.grade_level is null
           or ((l.grade_min is null or l.grade_min <= me.grade_level)
               and (l.grade_max is null or l.grade_max >= me.grade_level)))
      and (me.lat is null or me.lng is null or l.is_remote or l.lat is null or l.lng is null
           or public.haversine_miles(me.lat, me.lng, l.lat, l.lng) <= coalesce(me.radius_miles, 25))
      -- Later pages skip anything already shown (and marked seen) in this feed session.
      and (p_cursor is null or ul.seen_at is null or ul.seen_at < v_asof)
  ),
  scored as (
    select c.*,
      coalesce(fs.cnt, 0) as fs_cnt,
      coalesce(fs.people, '[]'::jsonb) as fs_people,
      ( 1.0 * least(3, coalesce((select sum(w.weight) from user_tag_weights w
                                 where w.user_id = p_user and w.tag = any(c.tags)), 0))
      + 0.8 * case
                when c.deadline is null then 0
                when c.deadline <= v_asof + interval '3 days' then 1.0
                when c.deadline <= v_asof + interval '7 days' then 0.7
                when c.deadline <= v_asof + interval '30 days' then 0.3
                else 0
              end
      + 0.5 * greatest(0, least(1, 1 - (extract(epoch from v_asof - c.created_at) / 86400 - 1) / 13))
      + 0.4 * least(1, coalesce(fs.cnt, 0) / 3.0)
      - 0.6 * coalesce(c.my_state = 'seen', false)::int
      + 0.15 * (('x' || substr(md5(p_user::text || c.id::text || (v_asof at time zone 'UTC')::date::text), 1, 7))::bit(28)::int
                / 268435455.0)
      )::double precision as rank_score
    from candidates c
    left join friend_saves_agg fs on fs.listing_id = c.id
  )
  select s.id, s.url, s.title, s.org_name, s.org_logo_url, s.type,
         s.description, s.summary, s.tags, s.location_text, s.is_remote,
         s.grade_min, s.grade_max, s.eligibility_text,
         s.deadline, s.starts_at, s.ends_at,
         s.compensation_text, s.amount_usd, s.image_url, s.image_alt,
         s.created_at, s.rank_score, v_asof, s.fs_cnt, s.fs_people
  from scored s
  where c_score is null or (s.rank_score, s.id) < (c_score, c_id)
  order by s.rank_score desc, s.id desc
  limit least(greatest(p_limit, 1), 50);
end;
$$;

revoke execute on function public.get_feed(uuid, int, jsonb) from public, anon;
grant execute on function public.get_feed(uuid, int, jsonb) to authenticated, service_role;

-- ---------- friend_saves (§5) ----------
-- A friend's saved items, only if the friendship is accepted, they share saves, and the item
-- isn't hidden from friends.
create or replace function public.friend_saves(friend_id uuid)
returns table (
  listing_id uuid, title text, org_name text, type opp_type,
  image_url text, image_alt text, deadline timestamptz, saved_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, l.org_name, l.type, l.image_url, l.image_alt, l.deadline,
         coalesce(ul.decided_at, ul.seen_at)
  from user_listings ul
  join listings l on l.id = ul.listing_id
  join profiles p on p.id = ul.user_id
  where ul.user_id = friend_id
    and ul.state = 'saved'
    and not ul.hidden_from_friends
    and p.share_saves
    and l.status = 'active'
    and public.friends_between(auth.uid(), friend_id)
  order by coalesce(ul.decided_at, ul.seen_at) desc;
$$;

revoke execute on function public.friend_saves(uuid) from public, anon;
grant execute on function public.friend_saves(uuid) to authenticated;

-- ---------- friend_activity (§5) ----------
-- Friends' saved/applied/accepted events, same visibility rules as friend_saves.
create or replace function public.friend_activity(p_limit int default 50, p_before timestamptz default null)
returns table (
  id uuid, actor_id uuid, username citext, display_name text, avatar_url text,
  verb text, listing_id uuid, title text, type opp_type, image_url text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select e.id, e.actor_id, p.username, p.display_name, p.avatar_url,
         e.verb, e.listing_id, l.title, l.type, l.image_url, e.created_at
  from activity_events e
  join public.friend_ids(auth.uid()) fr on fr.fid = e.actor_id
  join profiles p on p.id = e.actor_id
  join listings l on l.id = e.listing_id
  join user_listings ul on ul.user_id = e.actor_id and ul.listing_id = e.listing_id
  where p.share_saves
    and ul.state = 'saved'
    and not ul.hidden_from_friends
    and l.status = 'active'
    and (p_before is null or e.created_at < p_before)
  order by e.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.friend_activity(int, timestamptz) from public, anon;
grant execute on function public.friend_activity(int, timestamptz) to authenticated;

-- ---------- saved_overlaps (§9.8 overlap cards) ----------
-- "You and N friends saved X": my saved items that at least one friend visibly saved.
create or replace function public.saved_overlaps(p_limit int default 20)
returns table (listing_id uuid, title text, type opp_type, image_url text,
               friend_count int, friends jsonb)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, l.type, l.image_url, count(*)::int,
         to_jsonb((array_agg(
           jsonb_build_object('id', p.id, 'username', p.username,
                              'display_name', p.display_name, 'avatar_url', p.avatar_url)
           order by fu.decided_at desc nulls last))[1:3])
  from user_listings mine
  join listings l on l.id = mine.listing_id and l.status = 'active'
  join user_listings fu on fu.listing_id = mine.listing_id and fu.state = 'saved'
                       and not fu.hidden_from_friends
  join public.friend_ids(auth.uid()) fr on fr.fid = fu.user_id
  join profiles p on p.id = fu.user_id and p.share_saves
  where mine.user_id = auth.uid() and mine.state = 'saved'
  group by l.id, l.title, l.type, l.image_url
  order by count(*) desc, max(fu.decided_at) desc nulls last
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.saved_overlaps(int) from public, anon;
grant execute on function public.saved_overlaps(int) to authenticated;

-- ---------- chat daily cap (§6.6) ----------
-- Counts one message against today's cap (today in the user's timezone).
-- Returns how many remain after this one, or -1 if the cap was already reached (nothing counted).
create or replace function public.consume_chat_message(p_limit int)
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_day date;
  v_used int;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select timezone into v_tz from profiles where id = v_user;
  begin
    v_day := (now() at time zone coalesce(v_tz, 'America/New_York'))::date;
  exception when others then
    v_day := (now() at time zone 'America/New_York')::date;
  end;

  insert into ai_usage (user_id, day, messages) values (v_user, v_day, 0)
  on conflict (user_id, day) do nothing;

  update ai_usage set messages = messages + 1
  where user_id = v_user and day = v_day and messages < p_limit
  returning messages into v_used;

  if v_used is null then return -1; end if;
  return p_limit - v_used;
end;
$$;

-- Gives back one message when the model call failed (e.g. 429 "busy"), so it doesn't count.
create or replace function public.refund_chat_message()
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_tz text;
  v_day date;
begin
  select timezone into v_tz from profiles where id = auth.uid();
  begin
    v_day := (now() at time zone coalesce(v_tz, 'America/New_York'))::date;
  exception when others then
    v_day := (now() at time zone 'America/New_York')::date;
  end;
  update ai_usage set messages = greatest(0, messages - 1)
  where user_id = auth.uid() and day = v_day;
end;
$$;

revoke execute on function public.consume_chat_message(int) from public, anon;
revoke execute on function public.refund_chat_message() from public, anon;
grant execute on function public.consume_chat_message(int) to authenticated;
grant execute on function public.refund_chat_message() to authenticated;

-- ---------- invites (§8) ----------
-- Public lookup for the /invite/[code] landing page: inviter's public card only.
create or replace function public.invite_lookup(p_code text)
returns table (user_id uuid, username citext, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from invites i join profiles p on p.id = i.user_id
  where i.code = p_code;
$$;
grant execute on function public.invite_lookup(text) to anon, authenticated;

-- After sign-in: sends a friend request from the invitee to the inviter (who must accept).
-- Returns 'requested', 'already_friends', 'already_pending', 'self', 'blocked' or 'not_found'.
create or replace function public.redeem_invite(p_code text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
  v_status text;
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select user_id into v_inviter from invites where code = p_code;
  if v_inviter is null then return 'not_found'; end if;
  if v_inviter = v_me then return 'self'; end if;
  if public.blocked_between(v_me, v_inviter) then return 'blocked'; end if;

  select status into v_status from friendships
  where (requester_id = v_me and addressee_id = v_inviter)
     or (requester_id = v_inviter and addressee_id = v_me);
  if v_status = 'accepted' then return 'already_friends'; end if;
  if v_status = 'pending' then return 'already_pending'; end if;

  insert into friendships (requester_id, addressee_id) values (v_me, v_inviter);
  update invites set uses = uses + 1 where code = p_code;
  return 'requested';
end;
$$;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
