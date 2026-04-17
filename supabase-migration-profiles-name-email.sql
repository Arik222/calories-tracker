-- Migration: add first_name, last_name, email to profiles
-- Run in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;
