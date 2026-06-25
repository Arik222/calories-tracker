-- Migration: track whether the 100-completed-days milestone alert was shown
-- Run in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS milestone_100_days_shown_at timestamptz;
