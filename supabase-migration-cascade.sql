-- ============================================================
-- Migration: fix orphaned data on user deletion
-- Run this in the Supabase SQL editor ONCE.
--
-- Problem: daily_exercise_entries, calorie_target_history, and
-- user_custom_foods were created after the original setup and
-- do not have ON DELETE CASCADE foreign keys to auth.users.
-- Deleting a user left rows in those three tables.
--
-- Fix:
--   1. Add ON DELETE CASCADE FK to each missing table.
--   2. Recreate delete_my_account() to explicitly delete from
--      every user-scoped table before removing the auth row
--      (belt-and-suspenders alongside CASCADE).
-- ============================================================


-- ── 1. daily_exercise_entries ────────────────────────────────
-- Drop the existing FK (no CASCADE) and re-add it with CASCADE.
-- Supabase auto-names FKs as <table>_<column>_fkey.

alter table daily_exercise_entries
  drop constraint if exists daily_exercise_entries_user_id_fkey;

alter table daily_exercise_entries
  add constraint daily_exercise_entries_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;


-- ── 2. calorie_target_history ────────────────────────────────

alter table calorie_target_history
  drop constraint if exists calorie_target_history_user_id_fkey;

alter table calorie_target_history
  add constraint calorie_target_history_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;


-- ── 3. user_custom_foods ─────────────────────────────────────

alter table user_custom_foods
  drop constraint if exists user_custom_foods_user_id_fkey;

alter table user_custom_foods
  add constraint user_custom_foods_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;


-- ── 4. Recreate delete_my_account() ─────────────────────────
-- Explicitly deletes all user-scoped rows from every app table,
-- then deletes the auth.users row (which also triggers any
-- remaining CASCADE deletes as a safety net).
--
-- Runs as SECURITY DEFINER so it can delete from auth.users.
-- The search_path is pinned to prevent search-path injection.

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from daily_food_entries     where user_id = uid;
  delete from daily_exercise_entries where user_id = uid;
  delete from daily_summaries        where user_id = uid;
  delete from user_tracking_state    where user_id = uid;
  delete from calorie_target_history where user_id = uid;
  delete from user_custom_foods      where user_id = uid;
  delete from profiles               where id       = uid;

  -- Deleting from auth.users cascades to any tables still referencing it
  delete from auth.users where id = uid;
end;
$$;
