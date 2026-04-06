-- Migration: user_food_visibility
-- Stores foods the user has hidden, with the date from which they are hidden.
-- Replaces the is_hidden sentinel approach.
-- Run once in the Supabase SQL editor.

-- Drop the is_hidden column added in the previous migration (no longer needed)
ALTER TABLE daily_food_entries DROP COLUMN IF EXISTS is_hidden;

CREATE TABLE IF NOT EXISTS user_food_visibility (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name       text NOT NULL,
  hidden_from_date date NOT NULL,
  PRIMARY KEY (user_id, food_name)
);

ALTER TABLE user_food_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own food visibility"
  ON user_food_visibility
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
