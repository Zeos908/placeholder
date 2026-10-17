-- Keyset cursor fix: the score went through JSON as a rounded float, so a cursor that rounded up
-- let the last row of a page reappear on the next one. Rounding to 9 decimals makes it exact.

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
      round(( 1.0 * least(3, coalesce((select sum(w.weight) from user_tag_weights w
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
      )::numeric, 9)::double precision as rank_score
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
