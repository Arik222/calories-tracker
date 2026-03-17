-- ============================================================
-- Run this AFTER the original supabase-setup.sql
-- ============================================================

-- ── 1. user_tracking_state ───────────────────────────────────
-- Stores each user's current active tracking day.

create table user_tracking_state (
  user_id               uuid primary key references auth.users on delete cascade,
  current_tracking_date date not null
);

alter table user_tracking_state enable row level security;

create policy "select own tracking state"
  on user_tracking_state for select using (auth.uid() = user_id);
create policy "insert own tracking state"
  on user_tracking_state for insert with check (auth.uid() = user_id);
create policy "update own tracking state"
  on user_tracking_state for update using (auth.uid() = user_id);


-- ── 2. daily_summaries ───────────────────────────────────────
-- Stores one row per user per tracking day once finalized.

create table daily_summaries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users on delete cascade,
  tracking_date  date    not null,
  total_calories integer not null default 0,
  status         text    not null default 'open',  -- 'open' or 'completed'
  unique(user_id, tracking_date)
);

alter table daily_summaries enable row level security;

create policy "select own summaries"
  on daily_summaries for select using (auth.uid() = user_id);
create policy "insert own summaries"
  on daily_summaries for insert with check (auth.uid() = user_id);
create policy "update own summaries"
  on daily_summaries for update using (auth.uid() = user_id);
create policy "delete own summaries"
  on daily_summaries for delete using (auth.uid() = user_id);


-- ── 3. Initialize existing users with 2026-03-17 ─────────────
-- This sets the active tracking day for every user who already
-- exists in auth.users at the time this SQL is run.
-- New users who sign up AFTER this migration will be handled
-- by the app code (first login date becomes their first day).

insert into user_tracking_state (user_id, current_tracking_date)
select id, '2026-03-17'::date
from auth.users
on conflict (user_id) do nothing;
