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
