-- Migration: record_signup_consent RPC + unique constraint
-- Run in Supabase SQL editor

-- Prevent duplicate consent records per user per version
ALTER TABLE user_terms_consents
  ADD CONSTRAINT user_terms_consents_user_version_unique
  UNIQUE (user_id, terms_version);

-- SECURITY DEFINER function so anon callers (pre-email-confirmation) can
-- insert consent records. Validates the user was created within the last
-- 10 minutes to prevent forged consent for arbitrary user IDs.
CREATE OR REPLACE FUNCTION public.record_signup_consent(
  p_user_id      uuid,
  p_terms_version text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
      AND created_at > now() - interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'User not found or signup window expired';
  END IF;

  INSERT INTO user_terms_consents (user_id, terms_version)
  VALUES (p_user_id, p_terms_version)
  ON CONFLICT (user_id, terms_version) DO NOTHING;
END;
$$;

-- Allow unauthenticated (anon) and authenticated callers to invoke this function
GRANT EXECUTE ON FUNCTION public.record_signup_consent(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.record_signup_consent(uuid, text) TO authenticated;
