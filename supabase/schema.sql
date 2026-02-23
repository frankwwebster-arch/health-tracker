-- Health Tracker: tracker_days table + RLS
-- Run this in Supabase SQL Editor

create table if not exists public.tracker_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Index for fast lookups by user and date range
create index if not exists tracker_days_user_date_idx on public.tracker_days (user_id, date desc);

-- Enable RLS
alter table public.tracker_days enable row level security;

-- Users can select only their own rows
create policy "Users can select own tracker_days"
  on public.tracker_days for select
  using (auth.uid() = user_id);

-- Users can insert only their own rows
create policy "Users can insert own tracker_days"
  on public.tracker_days for insert
  with check (auth.uid() = user_id);

-- Users can update only their own rows
create policy "Users can update own tracker_days"
  on public.tracker_days for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete only their own rows
create policy "Users can delete own tracker_days"
  on public.tracker_days for delete
  using (auth.uid() = user_id);

-- Peloton connection credentials (encrypted server-side)
create table if not exists public.peloton_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username_encrypted text not null,
  password_encrypted text not null,
  username_hint text not null,
  last_tested_at timestamptz,
  last_test_status text check (last_test_status in ('success', 'failure')),
  last_test_error text,
  updated_at timestamptz not null default now()
);

create index if not exists peloton_connections_updated_idx
  on public.peloton_connections (updated_at desc);

alter table public.peloton_connections enable row level security;

drop policy if exists "Users can select own peloton_connections"
  on public.peloton_connections;
create policy "Users can select own peloton_connections"
  on public.peloton_connections for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own peloton_connections"
  on public.peloton_connections;
create policy "Users can insert own peloton_connections"
  on public.peloton_connections for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own peloton_connections"
  on public.peloton_connections;
create policy "Users can update own peloton_connections"
  on public.peloton_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own peloton_connections"
  on public.peloton_connections;
create policy "Users can delete own peloton_connections"
  on public.peloton_connections for delete
  using (auth.uid() = user_id);
