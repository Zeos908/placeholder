-- §5 triggers, plus small helpers the RLS policies and functions share.

-- ---------- helpers ----------

-- Two-party versions are internal: callable only from other security-definer functions, so a user
-- can't probe whether two other people are friends or have blocked each other.
create or replace function public.blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.friends_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

revoke execute on function public.blocked_between(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.friends_between(uuid, uuid) from public, anon, authenticated;

-- Caller-relative versions for RLS policies.
create or replace function public.is_blocked_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.blocked_between(auth.uid(), other);
$$;

create or replace function public.is_friend_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.friends_between(auth.uid(), other);
$$;

revoke execute on function public.is_blocked_with(uuid) from public, anon;
revoke execute on function public.is_friend_with(uuid) from public, anon;
grant execute on function public.is_blocked_with(uuid) to authenticated;
grant execute on function public.is_friend_with(uuid) to authenticated;

-- ---------- profiles: create one per new auth user ----------
-- username is required (needed for search); onboarding lets the user change this default.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := nullif(new.raw_user_meta_data ->> 'username', '');
  uname text;
begin
  if wanted is not null and wanted ~ '^[A-Za-z0-9_.]{3,30}$'
     and not exists (select 1 from profiles where username = wanted) then
    uname := wanted;
  else
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    uname,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- user_listings → activity_events ----------
create or replace function public.user_listings_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Newly saved.
  if new.state = 'saved' and (tg_op = 'INSERT' or old.state is distinct from 'saved') then
    insert into activity_events (actor_id, verb, listing_id) values (new.user_id, 'saved', new.listing_id);
  end if;

  -- app_status moved to applied / accepted.
  if new.state = 'saved' and new.app_status in ('applied','accepted')
     and (tg_op = 'INSERT' or old.app_status is distinct from new.app_status) then
    insert into activity_events (actor_id, verb, listing_id)
    values (new.user_id, new.app_status::text, new.listing_id);
  end if;

  -- Un-saved (undo, unsave, pass): drop the events so friends don't see a stale save.
  if tg_op = 'UPDATE' and old.state = 'saved' and new.state <> 'saved' then
    delete from activity_events where actor_id = new.user_id and listing_id = new.listing_id;
  end if;
  return new;
end;
$$;

create trigger user_listings_activity
  after insert or update of state, app_status on user_listings
  for each row execute function public.user_listings_activity();

create or replace function public.user_listings_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.state = 'saved' then
    delete from activity_events where actor_id = old.user_id and listing_id = old.listing_id;
  end if;
  return old;
end;
$$;

create trigger user_listings_deleted
  after delete on user_listings
  for each row execute function public.user_listings_deleted();

-- ---------- listings → ai_jobs ----------
-- New raw listings get an enrich job (the image job is created when enrich finishes, §6.4).
-- Rows inserted already enriched (e.g. seed data) go straight to an image job.
create or replace function public.listings_queue_ai()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.enriched then
    insert into ai_jobs (listing_id, kind, priority) values (new.id, 'enrich', 0)
    on conflict (listing_id, kind) do nothing;
  elsif new.image_url is null then
    insert into ai_jobs (listing_id, kind, priority) values (new.id, 'image', 0)
    on conflict (listing_id, kind) do nothing;
  end if;
  return new;
end;
$$;

create trigger listings_queue_ai
  after insert on listings
  for each row execute function public.listings_queue_ai();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_touch_updated_at
  before update on listings
  for each row execute function public.touch_updated_at();

-- ---------- blocks → remove friendship ----------
create or replace function public.blocks_remove_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from friendships
  where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
     or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return new;
end;
$$;

create trigger blocks_remove_friendship
  after insert on blocks
  for each row execute function public.blocks_remove_friendship();

-- ---------- reports → auto-hide listings (§12) ----------
create or replace function public.reports_autohide()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'listing'
     and (select count(distinct reporter_id) from reports
          where target_type = 'listing' and target_id = new.target_id) >= 3 then
    update listings set status = 'hidden' where id = new.target_id and status = 'active';
  end if;
  return new;
end;
$$;

create trigger reports_autohide
  after insert on reports
  for each row execute function public.reports_autohide();
