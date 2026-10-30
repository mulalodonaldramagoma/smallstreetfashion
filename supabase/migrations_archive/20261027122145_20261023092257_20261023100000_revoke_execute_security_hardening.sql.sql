-- Security Hardening: Revoke EXECUTE on Sensitive SECURITY DEFINER Functions
-- Applied: items 1, 2, and 4 only.
-- SKIPPED: item 3 (create_notification) — a later migration (20261027090000)
-- already replaced create_notification with a stricter authz check and
-- deliberately grants EXECUTE to authenticated so admin frontend can call it.
-- Re-applying this migration's older version would regress that fix.

-- 1. admin_resolve_report: revoke from authenticated (defense in depth;
--    internal is_current_admin() check still gates access)
REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM authenticated;

-- 2. admin_set_review_status: revoke from authenticated (defense in depth)
REVOKE EXECUTE ON FUNCTION public.admin_set_review_status(text, uuid, text) FROM authenticated;

-- 4. update_conversation_updated_at: revoke from anon and authenticated
--    (trigger function — should only fire via trigger, not via RPC)
REVOKE EXECUTE ON FUNCTION public.update_conversation_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_conversation_updated_at() FROM authenticated;