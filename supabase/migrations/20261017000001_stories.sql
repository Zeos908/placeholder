-- Front-end spec §10: stories ("Closing soon", "Near you", "Friends saved") and marking cards seen.

-- One story's items for the signed-in user. Uses the same hard filters as get_feed (active,
-- enriched, open deadline, not saved/passed, grade, location), then the story's own rule:
--   closing: deadline within 7 days (soonest first)
--   near:    in-person within the user's radius (needs their zip/coordinates)
--   friends: saved by an accepted friend who shares saves (most recent save first)
create or replace function public.story_deck(p_key text, p_limit int default 50)
returns table (
  id uuid, url text, title text, org_name text, org_logo_url text, type opp_type,
  description text, summary text, tags text[], location_text text, lat double precision,
  lng double precision, is_remote boolean, grade_min int, grade_max int, eligibility_text text,
  deadline timestamptz, starts_at timestamptz, ends_at timestamptz,
  compensation_text text, amount_usd numeric, image_url text, image_alt text,
  created_at timestamptz, seen boolean, friends_saved_count int, friends_saved jsonb
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  me profiles%rowtype;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_key not in ('closing', 'near', 'friends') then
    raise exception 'unknown story %', p_key using errcode = '22023';
  end if;
  select * into me from profiles where profiles.id = v_user;
  if p_key = 'near' and (me.lat is null or me.lng is null) then
    return;
  end if;

  return query
  with
  visible_saves as (
    select ul.listing_id, ul.decided_at, p.id as pid, p.username, p.display_name, p.avatar_url
    from user_listings ul
    join public.friend_ids(v_user) fr on fr.fid = ul.user_id
    join profiles p on p.id = ul.user_id
    where ul.state = 'saved' and not ul.hidden_from_friends and p.share_saves
  ),
  friend_agg as (
    select vs.listing_id,
           count(*)::int as cnt,
           max(vs.decided_at) as latest,
           to_jsonb((array_agg(
             jsonb_build_object('id', vs.pid, 'username', vs.username,
                                'display_name', vs.display_name, 'avatar_url', vs.avatar_url)
             order by vs.decided_at desc nulls last))[1:3]) as people
    from visible_saves vs
    group by vs.listing_id
  ),
  candidates as (
    select l.*, ul.state as my_state
    from listings l
    left join user_listings ul on ul.user_id = v_user and ul.listing_id = l.id
    where l.status = 'active'
      and l.enriched
      and (l.deadline is null or l.deadline > now())
      and (ul.state is null or ul.state = 'seen')
      and (me.grade_level is null
           or ((l.grade_min is null or l.grade_min <= me.grade_level)
               and (l.grade_max is null or l.grade_max >= me.grade_level)))
      and (me.lat is null or me.lng is null or l.is_remote or l.lat is null or l.lng is null
           or public.haversine_miles(me.lat, me.lng, l.lat, l.lng) <= coalesce(me.radius_miles, 25))
  )
  select c.id, c.url, c.title, c.org_name, c.org_logo_url, c.type,
         c.description, c.summary, c.tags, c.location_text, c.lat, c.lng, c.is_remote,
         c.grade_min, c.grade_max, c.eligibility_text,
         c.deadline, c.starts_at, c.ends_at, c.compensation_text, c.amount_usd,
         c.image_url, c.image_alt, c.created_at,
         coalesce(c.my_state = 'seen', false),
         coalesce(fa.cnt, 0), coalesce(fa.people, '[]'::jsonb)
  from candidates c
  left join friend_agg fa on fa.listing_id = c.id
  where case p_key
          when 'closing' then c.deadline is not null and c.deadline <= now() + interval '7 days'
          when 'near' then not c.is_remote and c.lat is not null and c.lng is not null
                           and public.haversine_miles(me.lat, me.lng, c.lat, c.lng) <= coalesce(me.radius_miles, 25)
          else fa.cnt is not null
        end
  order by
    case when p_key = 'closing' then c.deadline end asc nulls last,
    case when p_key = 'friends' then fa.latest end desc nulls last,
    c.created_at desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;
revoke execute on function public.story_deck(text, int) from public, anon;
grant execute on function public.story_deck(text, int) to authenticated;

-- The stories row: counts, unseen counts, and (friends story) the 2 most recent savers' avatars.
-- Stories with no items are left out; "near" is left out when the user has no location.
create or replace function public.get_stories()
returns table (key text, count int, unseen_count int, avatars text[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  select k.key, d.cnt, d.unseen,
         case when k.key = 'friends' then (
           select array_agg(x.avatar_url order by x.latest desc)
           from (
             select p.avatar_url, max(ul.decided_at) as latest
             from user_listings ul
             join public.friend_ids(auth.uid()) fr on fr.fid = ul.user_id
             join profiles p on p.id = ul.user_id
             where ul.state = 'saved' and not ul.hidden_from_friends and p.share_saves
               and ul.listing_id in (select s.id from public.story_deck('friends', 100) s)
             group by p.id, p.avatar_url
             order by latest desc
             limit 2
           ) x
         ) end
  from (values (1, 'closing'), (2, 'near'), (3, 'friends')) as k(ord, key)
  cross join lateral (
    select count(*)::int as cnt, count(*) filter (where not s.seen)::int as unseen
    from public.story_deck(k.key, 100) s
  ) d
  where d.cnt > 0
  order by k.ord;
end;
$$;
revoke execute on function public.get_stories() from public, anon;
grant execute on function public.get_stories() to authenticated;

-- POST /api/seen: mark listings seen (feed ≥ 2 s on screen, or shown on top of a story deck).
-- Never overwrites saved/passed; refreshes seen_at on rows that are already 'seen'.
create or replace function public.mark_seen(p_ids uuid[])
returns void language sql volatile security definer set search_path = public as $$
  insert into user_listings (user_id, listing_id, state, seen_at)
  select auth.uid(), l.id, 'seen', now()
  from listings l
  where l.id = any(p_ids) and auth.uid() is not null
  on conflict (user_id, listing_id) do update
    set seen_at = now()
    where user_listings.state = 'seen';
$$;
revoke execute on function public.mark_seen(uuid[]) from public, anon;
grant execute on function public.mark_seen(uuid[]) to authenticated;
