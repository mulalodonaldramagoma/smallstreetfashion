-- Corrective migration: revoke EXECUTE on get_reconciliation_summary from PUBLIC
-- Migration 10 recreated the function, which reset default grants. REVOKE FROM
-- anon alone is insufficient because PostgreSQL SECURITY DEFINER functions are
-- callable by PUBLIC by default. Revoking from PUBLIC and re-granting to
-- authenticated and service_role closes the anon gap.

REVOKE EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) TO authenticated, service_role;
