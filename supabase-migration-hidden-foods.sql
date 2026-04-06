-- Migration: user_hidden_default_foods
-- Stores default foods that a user has permanently removed from their list.
-- Run once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS user_hidden_default_foods (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name text NOT NULL,
  PRIMARY KEY (user_id, food_name)
);

ALTER TABLE user_hidden_default_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own hidden foods"
  ON user_hidden_default_foods
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
