-- Fix reconciliation function execute grants: remove PUBLIC, grant only authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) TO authenticated, service_role;