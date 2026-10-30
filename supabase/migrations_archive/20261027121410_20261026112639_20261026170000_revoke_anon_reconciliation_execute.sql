-- Revoke EXECUTE on get_reconciliation_summary from anon (defense in depth)
REVOKE EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) FROM anon;