-- Phase 2: onboarding state, username availability, and the blocked-users list for Settings.

-- Set when the user finishes or skips onboarding; null sends them to /onboarding after sign-in.
alter table profiles add column onboarded_at timestamptz;
grant update (onboarded_at) on profiles to authenticated;

-- Live availability check for the username field. Checks every profile, including users hidden
-- from the caller by a block, so the answer is always correct. Reveals nothing else.
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_username ~ '^[A-Za-z0-9_.]{3,30}$'
     and not exists (
       select 1 from profiles where username = p_username::citext and id <> auth.uid()
     );
$$;
revoke execute on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

-- Users the caller has blocked, with the public card fields Settings shows.
-- (public_profiles hides blocked users, so Settings can't read them from there.)
create or replace function public.my_blocked_users()
returns table (id uuid, username citext, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from blocks b join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by p.username;
$$;
revoke execute on function public.my_blocked_users() from public, anon;
grant execute on function public.my_blocked_users() to authenticated;

-- Initial interest weights (§7): each chosen interest starts at 1.0. Existing learned weights are
-- kept when they're already higher, so re-saving interests in Settings doesn't undo learning.
create or replace function public.seed_interest_weights(p_tags text[])
returns void language sql volatile security invoker set search_path = public as $$
  insert into user_tag_weights (user_id, tag, weight)
  select auth.uid(), t, 1.0 from unnest(p_tags) as t
  on conflict (user_id, tag) do update
    set weight = greatest(user_tag_weights.weight, excluded.weight);
$$;
revoke execute on function public.seed_interest_weights(text[]) from public, anon;
grant execute on function public.seed_interest_weights(text[]) to authenticated;
