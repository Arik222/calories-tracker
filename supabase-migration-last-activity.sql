-- Migration: track login, app-open, activity, and signup timestamps per profile
-- Run in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_login_at       timestamptz,
  ADD COLUMN IF NOT EXISTS last_app_open_at    timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at    timestamptz,
  ADD COLUMN IF NOT EXISTS signup_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS signup_activated_at timestamptz;
