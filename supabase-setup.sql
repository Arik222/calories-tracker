-- ============================================================
-- STEP 1: Create tables
-- ============================================================

-- User profiles (one row per user, stores their calorie target)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  daily_calorie_target integer default 2300
);

-- Daily food entries
create table daily_food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  date date not null,
  food_name text not null,
  calories_per_unit integer not null,
  quantity numeric not null default 1,
  unique(user_id, date, food_name)   -- needed for upsert to work
);

-- ============================================================
-- STEP 2: Enable Row Level Security (RLS)
-- ============================================================

alter table profiles enable row level security;
alter table daily_food_entries enable row level security;

-- ============================================================
-- STEP 3: Add policies (users can only touch their own rows)
-- ============================================================

-- profiles
create policy "select own profile"
  on profiles for select using (auth.uid() = id);

create policy "insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "update own profile"
  on profiles for update using (auth.uid() = id);

-- daily_food_entries
create policy "select own entries"
  on daily_food_entries for select using (auth.uid() = user_id);

create policy "insert own entries"
  on daily_food_entries for insert with check (auth.uid() = user_id);

create policy "update own entries"
  on daily_food_entries for update using (auth.uid() = user_id);

create policy "delete own entries"
  on daily_food_entries for delete using (auth.uid() = user_id);
