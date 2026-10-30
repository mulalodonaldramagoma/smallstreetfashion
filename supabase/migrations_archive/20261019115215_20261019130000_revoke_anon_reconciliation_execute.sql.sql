-- Revoke EXECUTE on the admin reconciliation function from anon.
-- The function body already enforces is_admin() at runtime, but the grant
-- should not be exposed to the unauthenticated role as defense in depth.
REVOKE EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamp with time zone, timestamp with time zone, text, uuid, text, text) FROM anon;

-- Confirm remaining grantees
SELECT has_function_privilege('anon','public.get_reconciliation_summary(timestamp with time zone, timestamp with time zone, text, uuid, text, text)'::regprocedure,'EXECUTE') AS anon_can_exec,
       has_function_privilege('authenticated','public.get_reconciliation_summary(timestamp with time zone, timestamp with time zone, text, uuid, text, text)'::regprocedure,'EXECUTE') AS auth_can_exec;
