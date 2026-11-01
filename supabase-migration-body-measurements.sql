-- Dated body circumference records, separate from profile details and daily calories.
BEGIN;
CREATE TABLE IF NOT EXISTS public.body_measurements (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 measured_on date NOT NULL,
 arm_cm numeric(5,1) CHECK (arm_cm > 0 AND arm_cm <= 300),
 chest_cm numeric(5,1) CHECK (chest_cm > 0 AND chest_cm <= 300),
 abdomen_cm numeric(5,1) CHECK (abdomen_cm > 0 AND abdomen_cm <= 300),
 leg_cm numeric(5,1) CHECK (leg_cm > 0 AND leg_cm <= 300),
 notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, measured_on),
 CHECK (num_nonnulls(arm_cm, chest_cm, abdomen_cm, leg_cm) > 0)
);
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own body measurements" ON public.body_measurements FOR ALL TO authenticated
 USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.body_measurements FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_measurements TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
