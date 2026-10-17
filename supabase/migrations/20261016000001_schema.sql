-- §5 schema: extensions, enums, tables, indexes.

create extension if not exists citext;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create type opp_type   as enum ('internship','volunteer','event','scholarship');
create type ul_state   as enum ('seen','saved','passed');
create type app_status as enum ('interested','applying','applied','accepted','rejected');
create type job_status as enum ('queued','running','done','failed');

-- Grade levels stored as ints: 9–12 = HS grades, 13–16 = college years 1–4, 17 = grad.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username citext unique not null
    check (username ~ '^[A-Za-z0-9_.]{3,30}$'),
  display_name text check (char_length(display_name) <= 60),
  avatar_url text,
  grade_level int check (grade_level between 9 and 17),
  school text check (char_length(school) <= 120),
  zip text check (zip ~ '^\d{5}$'),
  lat double precision, lng double precision,
  radius_miles int default 25 check (radius_miles between 5 and 100),
  interests text[] default '{}',
  skills text[] default '{}',
  bio text check (char_length(bio) <= 300),
  share_saves boolean default true,
  theme text default 'system' check (theme in ('system','light','dark')),
  timezone text default 'America/New_York',
  created_at timestamptz default now()
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  source text not null, source_id text not null,
  url text not null,
  title text not null, org_name text, org_logo_url text,
  type opp_type not null,
  description text, summary text,
  tags text[] default '{}',
  location_text text, lat double precision, lng double precision,
  is_remote boolean default false,
  grade_min int, grade_max int, eligibility_text text,
  deadline timestamptz, starts_at timestamptz, ends_at timestamptz,
  compensation_text text, amount_usd numeric,
  image_url text, image_alt text, image_prompt text,
  enriched boolean default false,
  status text default 'active' check (status in ('active','expired','hidden')),
  dedupe_hash text unique not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (source, source_id)
);
create index listings_feed_idx on listings (status, enriched, deadline);
create index listings_tags_idx on listings using gin (tags);

create table user_listings (
  user_id uuid references profiles on delete cascade,
  listing_id uuid references listings on delete cascade,
  state ul_state not null,
  app_status app_status,
  hidden_from_friends boolean default false,
  seen_at timestamptz default now(), decided_at timestamptz,
  primary key (user_id, listing_id)
);
create index user_listings_listing_idx on user_listings (listing_id, state);

create table user_tag_weights (
  user_id uuid references profiles on delete cascade,
  tag text, weight real default 0,
  primary key (user_id, tag)
);

create table friendships (
  requester_id uuid references profiles on delete cascade,
  addressee_id uuid references profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index friendships_addressee_idx on friendships (addressee_id, status);
-- At most one row per pair regardless of direction.
create unique index friendships_pair_idx
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table invites (
  code text primary key,
  user_id uuid unique references profiles on delete cascade,
  created_at timestamptz default now(),
  uses int default 0
);

create table shares (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references profiles on delete cascade,
  to_user uuid references profiles on delete cascade,
  listing_id uuid references listings on delete cascade,
  message text check (char_length(message) <= 500),
  created_at timestamptz default now(), read_at timestamptz
);
create index shares_to_user_idx on shares (to_user, read_at, created_at desc);

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles on delete cascade,
  verb text check (verb in ('saved','applied','accepted')),
  listing_id uuid references listings on delete cascade,
  created_at timestamptz default now()
);
create index activity_events_actor_idx on activity_events (actor_id, created_at desc);

create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  listing_id uuid references listings on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, listing_id)
);
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references chat_threads on delete cascade,
  role text check (role in ('user','assistant','tool')), content text,
  created_at timestamptz default now()
);
create index chat_messages_thread_idx on chat_messages (thread_id, created_at);

create table ai_usage (
  user_id uuid references profiles on delete cascade,
  day date,
  messages int default 0,
  primary key (user_id, day)
);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  listing_id uuid references listings on delete cascade,
  remind_at timestamptz not null, title text not null, note text,
  source text check (source in ('auto','ai','user')), sent_at timestamptz
);
create index reminders_due_idx on reminders (remind_at) where sent_at is null;
create index reminders_user_listing_idx on reminders (user_id, listing_id);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  listing_id uuid references listings on delete cascade,
  text text not null, done boolean default false, position int
);
create index checklist_items_user_listing_idx on checklist_items (user_id, listing_id, position);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  kind text, payload jsonb, read_at timestamptz, created_at timestamptz default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  endpoint text unique, p256dh text, auth text
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles on delete cascade,
  target_type text check (target_type in ('user','listing')), target_id uuid,
  reason text, created_at timestamptz default now(),
  unique (reporter_id, target_type, target_id)
);

create table blocks (
  blocker_id uuid references profiles on delete cascade,
  blocked_id uuid references profiles on delete cascade,
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on blocks (blocked_id);

create table ai_jobs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings on delete cascade,
  kind text check (kind in ('enrich','image')),
  priority int default 0,                  -- import = 0, user prefetch = 100
  status job_status default 'queued', attempts int default 0,
  last_error text, run_after timestamptz default now(),
  created_at timestamptz default now(), unique (listing_id, kind)
);
create index ai_jobs_dequeue_idx on ai_jobs (priority desc, created_at) where status = 'queued';

create table source_runs (
  id uuid primary key default gen_random_uuid(), source text,
  started_at timestamptz, finished_at timestamptz, fetched int, inserted int, errors jsonb
);

-- Storage buckets: AI listing images (public read, service-role writes) and user avatars.
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;
