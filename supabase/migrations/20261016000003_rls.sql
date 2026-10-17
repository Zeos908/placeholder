-- §5 Row Level Security. RLS is enabled on every table; tables with no policy are service-role only.

alter table profiles          enable row level security;
alter table listings          enable row level security;
alter table user_listings     enable row level security;
alter table user_tag_weights  enable row level security;
alter table friendships       enable row level security;
alter table invites           enable row level security;
alter table shares            enable row level security;
alter table activity_events   enable row level security;
alter table chat_threads      enable row level security;
alter table chat_messages     enable row level security;
alter table ai_usage          enable row level security;
alter table reminders         enable row level security;
alter table checklist_items   enable row level security;
alter table notifications     enable row level security;
alter table push_subscriptions enable row level security;
alter table reports           enable row level security;
alter table blocks            enable row level security;
alter table ai_jobs           enable row level security;   -- service role only (no policies)
alter table source_runs       enable row level security;   -- service role only (no policies)

-- ---------- profiles ----------
-- The full row (zip, lat/lng, skills, settings) is owner-only. Everyone else reads the public
-- columns through public_profiles, which also hides users blocked in either direction.
create policy "profiles: owner reads" on profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner updates" on profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on profiles from authenticated;
grant update (username, display_name, avatar_url, grade_level, school, zip, lat, lng, radius_miles,
              interests, skills, bio, share_saves, theme, timezone)
  on profiles to authenticated;

create view public_profiles with (security_invoker = false) as
  select id, username, display_name, avatar_url, school, grade_level, interests, bio
  from profiles p
  where (select auth.uid()) is not null
    and not public.blocked_between((select auth.uid()), p.id);
revoke all on public_profiles from anon, public;
grant select on public_profiles to authenticated;

-- ---------- listings ----------
-- Active listings for everyone signed in; a listing that expired stays readable to users who saved it,
-- so their Saved tab and chat keep working. Writes: service role only.
create policy "listings: read active or own saved" on listings
  for select to authenticated using (
    status = 'active'
    or (status = 'expired' and exists (
      select 1 from user_listings ul
      where ul.listing_id = listings.id and ul.user_id = (select auth.uid()) and ul.state = 'saved'))
  );

-- ---------- owner-only tables ----------
create policy "user_listings: owner" on user_listings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "user_tag_weights: owner" on user_tag_weights
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "chat_threads: owner" on chat_threads
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "chat_messages: thread owner" on chat_messages
  for all to authenticated
  using (exists (select 1 from chat_threads t where t.id = thread_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from chat_threads t where t.id = thread_id and t.user_id = (select auth.uid())));

-- ai_usage is read-only for the owner; it's incremented by consume_chat_message() so the
-- daily cap can't be reset from the client.
create policy "ai_usage: owner reads" on ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

create policy "reminders: owner" on reminders
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "checklist_items: owner" on checklist_items
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Notifications are created server-side; the owner reads, marks read, and deletes.
create policy "notifications: owner reads" on notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: owner marks read" on notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: owner deletes" on notifications
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

create policy "push_subscriptions: owner" on push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- friendships ----------
create policy "friendships: parties read" on friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy "friendships: request" on friendships
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and not public.is_blocked_with(addressee_id)
  );
-- Only the addressee can accept, and only the status column can change.
create policy "friendships: addressee accepts" on friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
revoke update on friendships from authenticated;
grant update (status) on friendships to authenticated;
-- Either side can decline, cancel, or unfriend.
create policy "friendships: parties delete" on friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- ---------- invites ----------
create policy "invites: owner" on invites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "invites: owner creates" on invites
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------- shares ----------
create policy "shares: sender or recipient reads" on shares
  for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));
create policy "shares: send to accepted friends" on shares
  for insert to authenticated
  with check (
    from_user = (select auth.uid())
    and public.is_friend_with(to_user)
    and not public.is_blocked_with(to_user)
  );
create policy "shares: recipient marks read" on shares
  for update to authenticated
  using (to_user = (select auth.uid())) with check (to_user = (select auth.uid()));
revoke update on shares from authenticated;
grant update (read_at) on shares to authenticated;

-- ---------- activity_events ----------
-- Own events only; friends' events go through friend_activity() (§5).
create policy "activity_events: own" on activity_events
  for select to authenticated using (actor_id = (select auth.uid()));

-- ---------- reports / blocks ----------
create policy "reports: own insert" on reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "reports: own read" on reports
  for select to authenticated using (reporter_id = (select auth.uid()));

create policy "blocks: own insert" on blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "blocks: own read" on blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks: own delete" on blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- ---------- storage ----------
-- listing-images: public read (bucket is public); writes only via service role.
-- avatars: each user writes only inside a folder named after their user id.
create policy "avatars: owner writes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
