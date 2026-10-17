-- Function calls inside a view run with the caller's privileges, so public_profiles can't use the
-- internal blocked_between(). Use the caller-relative is_blocked_with(), which authenticated may run.
create or replace view public_profiles with (security_invoker = false) as
  select id, username, display_name, avatar_url, school, grade_level, interests, bio
  from profiles p
  where (select auth.uid()) is not null
    and not public.is_blocked_with(p.id);
