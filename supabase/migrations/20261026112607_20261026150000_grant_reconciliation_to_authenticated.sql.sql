-- Grant reconciliation function execution to authenticated role (migration 9)
-- The function enforces admin-only access via private.is_admin() internally.

GRANT EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) TO authenticated;
