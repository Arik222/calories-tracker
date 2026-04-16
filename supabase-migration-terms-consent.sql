-- Migration: user_terms_consents table
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS user_terms_consents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version   text        NOT NULL,
  accepted_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_terms_consents ENABLE ROW LEVEL SECURITY;

-- Users can read their own consent records
CREATE POLICY "Users can read own consent"
  ON user_terms_consents FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own consent record (one-time, on signup)
CREATE POLICY "Users can insert own consent"
  ON user_terms_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);
