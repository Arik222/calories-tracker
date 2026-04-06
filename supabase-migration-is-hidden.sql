-- Migration: add is_hidden to daily_food_entries
-- Run once in the Supabase SQL editor.

ALTER TABLE daily_food_entries
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
