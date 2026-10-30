/*
# C4: Fix Notification and Admin-Review Function Permissions

## Problem
Migration 20261023092257 (Step 46, revoke_execute_security_hardening) added
an authorization guard to create_notification() but also revoked EXECUTE
from authenticated on three functions that the frontend needs to call:

1. create_notification — called by adminService.ts (frontend admin panel)
2. admin_resolve_report — called by reviewService.ts (frontend admin panel)
3. admin_set_review_status — called by reviewService.ts (frontend admin panel)

The revoke on create_notification was intended as defense-in-depth, but
it breaks the admin frontend which calls it via supabase.rpc() with the
authenticated user's session. The same applies to the two review functions.

## Fix

### create_notification
Replace the function with the corrected version that:
- Keeps the Oct 23 guard: IF auth.uid() IS NOT NULL AND NOT is_current_admin()
  THEN RAISE EXCEPTION. This allows:
    - service_role edge functions (auth.uid() is NULL -> guard skipped)
    - admin frontend calls (auth.uid() set, is_current_admin() true -> guard skipped)
    - rejects non-admin authenticated users (guard fires)
    - anon cannot call at all (EXECUTE revoked from anon)
- Grants EXECUTE to authenticated AND service_role.
- Revokes EXECUTE from PUBLIC and anon.
- Preserves SECURITY DEFINER, search_path = 'public', and the 5-minute
  deduplication logic.

### admin_resolve_report and admin_set_review_status
Both functions have internal is_current_admin() guards (verified in
migration 20261026113247, lines 467 and 497) that raise an exception for
non-admins. Restoring EXECUTE to authenticated is safe because:
- The internal guard rejects non-admins before any data changes.
- RLS policies on the underlying tables also check is_current_admin().
- service_role already has EXECUTE (SECURITY DEFINER runs as owner).

## Security analysis
- Untrusted authenticated users: rejected by is_current_admin() inside
  each function before any mutation occurs.
- Anon role: EXECUTE revoked, cannot call any of the three functions.
- service_role: bypasses auth.uid() check (NULL), can call all functions.
  This is correct for the send-notification edge function.
- No changes to function bodies of admin_resolve_report or
  admin_set_review_status -- only GRANT statements are added.
*/

-- ============================================================
-- 1. create_notification: corrected guard + grants
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_action_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  -- Allow service_role (auth.uid() is NULL) and verified admins.
  -- Reject non-admin authenticated users.
  IF auth.uid() IS NOT NULL AND NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admins or server processes can create notifications';
  END IF;

  SELECT id INTO existing_id
  FROM notifications
  WHERE user_id = p_user_id
    AND type = p_type
    AND (entity_type IS NOT DISTINCT FROM p_entity_type)
    AND (entity_id IS NOT DISTINCT FROM p_entity_id)
    AND created_at > now() - interval '5 minutes'
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO notifications (user_id, category, type, title, body, entity_type, entity_id, action_url)
  VALUES (p_user_id, p_category, p_type, p_title, p_body, p_entity_type, p_entity_id, p_action_url)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

-- Grant to authenticated (admin frontend) and service_role (edge functions).
-- Revoke from PUBLIC and anon so untrusted callers cannot invoke it.
REVOKE EXECUTE ON FUNCTION public.create_notification(
  uuid, text, text, text, text, text, uuid, text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification(
  uuid, text, text, text, text, text, uuid, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_notification(
  uuid, text, text, text, text, text, uuid, text
) TO authenticated, service_role;

-- ============================================================
-- 2. Restore EXECUTE on admin_resolve_report for authenticated
--    (internal is_current_admin() guard verified at line 497
--     of 20261026113247_...stage_a_ratings_and_reviews.sql.sql)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO authenticated;

-- ============================================================
-- 3. Restore EXECUTE on admin_set_review_status for authenticated
--    (internal is_current_admin() guard verified at line 467
--     of 20261026113247_...stage_a_ratings_and_reviews.sql.sql)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.admin_set_review_status(text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_review_status(text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_review_status(text, uuid, text) TO authenticated;
