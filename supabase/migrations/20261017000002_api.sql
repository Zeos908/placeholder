-- Phase F8: SQL behind the real API routes.

-- ---------- swipes (build spec §7, §10) ----------
-- Records a save/pass in one transaction: the user_listings row, tag-weight learning
-- (+0.5 capped at 3 on save, −0.3 floored at −2 on pass), and automatic reminders on save
-- (7 days and 2 days before the deadline, and 9 AM local on the day; past ones skipped).
-- Returns everything needed to undo it exactly.
create or replace function public.swipe_listing(p_listing uuid, p_direction text, p_learn boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_prev user_listings%rowtype;
  v_had boolean;
  v_listing listings%rowtype;
  v_tz text;
  v_state ul_state;
  v_step real;
  v_tag text;
  v_old real;
  v_new real;
  v_deltas jsonb := '{}'::jsonb;
  v_reminders uuid[] := '{}';
  v_at timestamptz;
  v_id uuid;
begin
  if v_user is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_direction not in ('right', 'left') then raise exception 'bad direction' using errcode = '22023'; end if;
  select * into v_listing from listings where id = p_listing;
  if not found then raise exception 'listing not found' using errcode = 'P0002'; end if;

  select * into v_prev from user_listings where user_id = v_user and listing_id = p_listing;
  v_had := found;
  v_state := case when p_direction = 'right' then 'saved'::ul_state else 'passed'::ul_state end;

  insert into user_listings (user_id, listing_id, state, app_status, seen_at, decided_at)
  values (v_user, p_listing, v_state, case when v_state = 'saved' then 'interested'::app_status end, now(), now())
  on conflict (user_id, listing_id) do update
    set state = excluded.state,
        app_status = excluded.app_status,
        decided_at = now();

  if p_learn then
    v_step := case when p_direction = 'right' then 0.5 else -0.3 end;
    foreach v_tag in array coalesce(v_listing.tags, '{}') loop
      select weight into v_old from user_tag_weights where user_id = v_user and tag = v_tag;
      v_old := coalesce(v_old, 0);
      v_new := greatest(-2, least(3, v_old + v_step));
      if v_new <> v_old then
        insert into user_tag_weights (user_id, tag, weight) values (v_user, v_tag, v_new)
        on conflict (user_id, tag) do update set weight = excluded.weight;
        v_deltas := v_deltas || jsonb_build_object(v_tag, v_new - v_old);
      end if;
    end loop;
  end if;

  if v_state = 'saved' and v_listing.deadline is not null then
    select coalesce(timezone, 'America/New_York') into v_tz from profiles where id = v_user;
    foreach v_at in array array[
      v_listing.deadline - interval '7 days',
      v_listing.deadline - interval '2 days',
      ((v_listing.deadline at time zone v_tz)::date + time '09:00') at time zone v_tz
    ] loop
      if v_at > now() then
        insert into reminders (user_id, listing_id, remind_at, title, source)
        values (v_user, p_listing, v_at,
                case when v_at::date = v_listing.deadline::date then 'Due today: ' else 'Coming up: ' end || v_listing.title,
                'auto')
        returning id into v_id;
        v_reminders := v_reminders || v_id;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'listing_id', p_listing,
    'state', v_state,
    'prev', case when v_had then to_jsonb(v_prev) else null end,
    'deltas', v_deltas,
    'reminders', to_jsonb(v_reminders)
  );
end;
$$;
revoke execute on function public.swipe_listing(uuid, text, boolean) from public, anon;
grant execute on function public.swipe_listing(uuid, text, boolean) to authenticated;

-- Reverses swipe_listing exactly: previous row (or none), the same weight deltas, and the
-- reminders it created. The route verifies the signed, 10-second undo token before calling.
create or replace function public.undo_swipe(p_listing uuid, p_prev jsonb, p_deltas jsonb, p_reminders uuid[])
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_tag text;
  v_delta real;
begin
  if v_user is null then raise exception 'not signed in' using errcode = '42501'; end if;

  if p_prev is null or p_prev = 'null'::jsonb then
    delete from user_listings where user_id = v_user and listing_id = p_listing;
  else
    update user_listings set
      state = (p_prev ->> 'state')::ul_state,
      app_status = (p_prev ->> 'app_status')::app_status,
      hidden_from_friends = coalesce((p_prev ->> 'hidden_from_friends')::boolean, false),
      seen_at = (p_prev ->> 'seen_at')::timestamptz,
      decided_at = (p_prev ->> 'decided_at')::timestamptz
    where user_id = v_user and listing_id = p_listing;
  end if;

  for v_tag, v_delta in select key, value::real from jsonb_each_text(coalesce(p_deltas, '{}'::jsonb)) loop
    update user_tag_weights set weight = weight - v_delta where user_id = v_user and tag = v_tag;
  end loop;

  delete from reminders where user_id = v_user and id = any(coalesce(p_reminders, '{}'));
end;
$$;
revoke execute on function public.undo_swipe(uuid, jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.undo_swipe(uuid, jsonb, jsonb, uuid[]) to authenticated;

-- ---------- one listing's "saved by friends" (detail page, post sheet) ----------
create or replace function public.listing_friends_saved(p_listing uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', count(*),
    'people', coalesce(to_jsonb((array_agg(
      jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
      order by ul.decided_at desc nulls last))[1:3]), '[]'::jsonb)
  )
  from user_listings ul
  join public.friend_ids(auth.uid()) fr on fr.fid = ul.user_id
  join profiles p on p.id = ul.user_id
  where ul.listing_id = p_listing and ul.state = 'saved' and not ul.hidden_from_friends and p.share_saves;
$$;
revoke execute on function public.listing_friends_saved(uuid) from public, anon;
grant execute on function public.listing_friends_saved(uuid) to authenticated;

-- ---------- chat usage today (in the user's timezone) ----------
create or replace function public.chat_used_today()
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text;
  v_day date;
  v_used int;
begin
  select timezone into v_tz from profiles where id = auth.uid();
  begin
    v_day := (now() at time zone coalesce(v_tz, 'America/New_York'))::date;
  exception when others then
    v_day := (now() at time zone 'America/New_York')::date;
  end;
  select messages into v_used from ai_usage where user_id = auth.uid() and day = v_day;
  return coalesce(v_used, 0);
end;
$$;
revoke execute on function public.chat_used_today() from public, anon;
grant execute on function public.chat_used_today() to authenticated;

-- ---------- profiles (front-end spec §14) ----------
-- A profile card for /u/[username]: public fields, relationship to you, counts, and the grid.
-- Saves are visible to you (with hidden flags) or to accepted friends when they share saves.
create or replace function public.profile_card(p_username text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  p profiles%rowtype;
  v_rel text;
  v_can_see boolean;
  v_saves jsonb;
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into p from profiles where username = p_username::citext;
  if not found or public.blocked_between(v_me, p.id) then return null; end if;

  v_rel := case
    when p.id = v_me then 'self'
    when public.friends_between(v_me, p.id) then 'friend'
    when exists (select 1 from friendships where requester_id = v_me and addressee_id = p.id) then 'requested'
    when exists (select 1 from friendships where requester_id = p.id and addressee_id = v_me) then 'incoming'
    else 'none'
  end;
  v_can_see := v_rel = 'self' or (v_rel = 'friend' and p.share_saves);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'title', l.title, 'type', l.type, 'org_name', l.org_name,
           'image_url', l.image_url, 'image_alt', l.image_alt, 'deadline', l.deadline,
           'hidden_from_friends', v_rel = 'self' and ul.hidden_from_friends
         ) order by ul.decided_at desc nulls last), '[]'::jsonb)
  into v_saves
  from user_listings ul join listings l on l.id = ul.listing_id
  where v_can_see and ul.user_id = p.id and ul.state = 'saved' and l.status in ('active', 'expired')
    and (v_rel = 'self' or not ul.hidden_from_friends);

  return jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
    'school', p.school, 'grade_level', p.grade_level, 'interests', coalesce(p.interests, '{}'), 'bio', p.bio,
    'relationship', v_rel,
    'counts', jsonb_build_object(
      'saved', case when v_can_see then (select count(*) from user_listings where user_id = p.id and state = 'saved') else 0 end,
      'applied', case when v_can_see then (select count(*) from user_listings where user_id = p.id and state = 'saved'
                                             and app_status in ('applied', 'accepted', 'rejected')) else 0 end,
      'friends', (select count(*) from friendships where status = 'accepted' and p.id in (requester_id, addressee_id))
    ),
    'saves', v_saves
  );
end;
$$;
revoke execute on function public.profile_card(text) from public, anon;
grant execute on function public.profile_card(text) to authenticated;

-- ---------- Realtime: new notifications reach the bell live (front-end spec §19) ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
