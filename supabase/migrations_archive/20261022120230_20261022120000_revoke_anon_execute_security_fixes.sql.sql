-- Stage 2F: Revoke direct EXECUTE on trigger and reconciliation functions

-- 1. Revoke EXECUTE on enforce_role_immutable() from PUBLIC, anon, and authenticated.
--    This is a trigger function — it only needs to run via the trigger, not via RPC.
REVOKE EXECUTE ON FUNCTION public.enforce_role_immutable()
  FROM PUBLIC, anon, authenticated;

-- 2. Revoke EXECUTE on get_reconciliation_summary(...) from PUBLIC and anon.
--    The function has an internal private.is_admin() check, but anon should not
--    be able to invoke it at all. authenticated is preserved — admin users call it
--    and the function rejects non-admins internally.
REVOKE EXECUTE ON FUNCTION public.get_reconciliation_summary(
  timestamp with time zone, timestamp with time zone, text, uuid, text, text
) FROM PUBLIC, anon;
