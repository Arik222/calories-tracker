-- Migration: user_category_state
-- Persists per-user accordion open/collapse state for food categories.
-- Run once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS user_category_state (
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name text        NOT NULL,
  is_collapsed  boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, category_name)
);

ALTER TABLE user_category_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own category state"
  ON user_category_state
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
