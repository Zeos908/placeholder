-- "Continue as guest": Supabase anonymous sign-ins. A guest is a real auth user with no email,
-- so feed, saves, reminders and chat work unchanged. Guests can't use social features and are
-- invisible to everyone else.

alter table profiles add column if not exists is_guest boolean not null default false;
-- Not in the authenticated role's column grants (see rls.sql), so a guest can't clear it.

-- ---------- new users: flag guests, skip onboarding for them ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := nullif(new.raw_user_meta_data ->> 'username', '');
  guest boolean := coalesce(new.is_anonymous, false);
  uname text;
begin
  if guest then
    uname := 'guest_' || substr(replace(new.id::text, '-', ''), 1, 10);
  elsif wanted is not null and wanted ~ '^[A-Za-z0-9_.]{3,30}$'
     and not exists (select 1 from profiles where username = wanted) then
    uname := wanted;
  else
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into profiles (id, username, display_name, avatar_url, is_guest, onboarded_at)
  values (
    new.id,
    uname,
    case when guest then 'Guest'
         else coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name') end,
    new.raw_user_meta_data ->> 'avatar_url',
    guest,
    case when guest then now() end
  );
  return new;
end;
$$;

-- ---------- guests are invisible to other people ----------
create or replace view public_profiles with (security_invoker = false) as
  select id, username, display_name, avatar_url, school, grade_level, interests, bio
  from profiles p
  where (select auth.uid()) is not null
    and not public.is_blocked_with(p.id)
    and (not p.is_guest or p.id = (select auth.uid()));

-- ---------- guests can't send requests, shares or invites (enforced here, not just in the API) ----------
drop policy if exists "friendships: request" on friendships;
create policy "friendships: request" on friendships
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and not public.is_blocked_with(addressee_id)
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  );

drop policy if exists "shares: send to accepted friends" on shares;
create policy "shares: send to accepted friends" on shares
  for insert to authenticated
  with check (
    from_user = (select auth.uid())
    and public.is_friend_with(to_user)
    and not public.is_blocked_with(to_user)
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  );

drop policy if exists "invites: owner creates" on invites;
create policy "invites: owner creates" on invites
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  );

-- ---------- a guest's profile page isn't viewable by others ----------
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
  if not found or public.blocked_between(v_me, p.id) or (p.is_guest and p.id <> v_me) then return null; end if;

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

-- ---------- invite links: a guest opening one gets "guest", not a friend request ----------
create or replace function public.redeem_invite(p_code text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
  v_status text;
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then return 'guest'; end if;
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
