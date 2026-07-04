-- Migration: track whether the general cheer milestone was shown
-- Run in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS milestone_cheer_shown_at timestamptz;
