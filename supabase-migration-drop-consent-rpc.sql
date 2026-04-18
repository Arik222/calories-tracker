-- Migration: drop record_signup_consent SECURITY DEFINER function
-- Run in Supabase SQL editor (after supabase-migration-terms-consent-rpc.sql)
--
-- Consent is now inserted in loadProfile() on first authenticated login,
-- where auth.uid() is guaranteed and RLS enforces user isolation.
-- The SECURITY DEFINER approach is removed as it bypassed RLS.
-- The UNIQUE constraint added by the previous migration is kept.

REVOKE EXECUTE ON FUNCTION public.record_signup_consent(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_signup_consent(uuid, text) FROM authenticated;
DROP FUNCTION IF EXISTS public.record_signup_consent(uuid, text);
