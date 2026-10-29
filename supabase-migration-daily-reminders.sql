-- Daily reminders, isolated by user and tracking date. Safe to rerun.
BEGIN;
CREATE TABLE IF NOT EXISTS public.daily_reminders (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_date date NOT NULL,
  reminder_text text NOT NULL DEFAULT '' CHECK (char_length(reminder_text) <= 4000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tracking_date)
);
ALTER TABLE public.daily_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own daily reminders" ON public.daily_reminders;
CREATE POLICY "Users manage own daily reminders" ON public.daily_reminders
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.daily_reminders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reminders TO authenticated;
-- Preserve the old account-wide note on the user's currently active day.
-- Keep original metadata untouched as a backup; never replace an existing daily note.
INSERT INTO public.daily_reminders (user_id, tracking_date, reminder_text)
SELECT u.id, s.current_tracking_date, left(u.raw_user_meta_data->>'personal_reminder', 4000)
FROM auth.users u JOIN public.user_tracking_state s ON s.user_id = u.id
WHERE coalesce(u.raw_user_meta_data->>'personal_reminder', '') <> ''
ON CONFLICT (user_id, tracking_date) DO NOTHING;
COMMIT;
NOTIFY pgrst, 'reload schema';
