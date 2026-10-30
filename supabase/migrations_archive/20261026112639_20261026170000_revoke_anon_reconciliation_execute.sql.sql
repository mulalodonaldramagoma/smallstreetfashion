-- Revoke EXECUTE on the admin reconciliation function from anon (migration 11)
-- The function body already enforces is_admin() at runtime, but the grant
-- should not be exposed to the unauthenticated role as defense in depth.

REVOKE EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) FROM anon;
