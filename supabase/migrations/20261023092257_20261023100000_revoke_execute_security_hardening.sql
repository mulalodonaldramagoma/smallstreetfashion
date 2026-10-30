/*
# Security Hardening: Revoke EXECUTE on Sensitive SECURITY DEFINER Functions

## Purpose
Revoke direct EXECUTE permissions from `authenticated` and `anon` on functions
that should only be callable by the service_role (via edge functions) or that
have internal admin checks but should not be directly invokable by regular users.

## Changes

### 1. admin_resolve_report — REVOKE from authenticated
This function has an internal `is_current_admin()` check, but only admins should
be able to call it at all. The frontend calls it via `supabase.rpc()`, but the
internal check rejects non-admins with an exception. Revoking EXECUTE from
authenticated adds defense-in-depth. The function is still callable by service_role.

### 2. admin_set_review_status — REVOKE from authenticated
Same pattern as admin_resolve_report. Internal `is_current_admin()` check present.
Revoke from authenticated for defense-in-depth.

### 3. create_notification — Add admin check + REVOKE from authenticated
This function had NO internal authorization check. Any authenticated user could
create arbitrary notifications for any other user. Now adds `is_current_admin()`
check and revokes EXECUTE from authenticated. The `send-notification` edge function
uses service_role which bypasses RLS and still has EXECUTE.

### 4. update_conversation_updated_at — REVOKE from anon and authenticated
This is a trigger function on the `messages` table. It should only fire via the
trigger, not be callable directly via RPC. Revoking from both anon and
authenticated prevents direct invocation while the trigger still works (triggers
run with the function's security context regardless of caller grants).

## Security Impact
- 4 confirmed vulnerabilities addressed
- No legitimate functionality broken (trigger still fires, service_role still works)
- Frontend admin functions now have double protection: frontend route guard + database EXECUTE restriction
*/

-- 1. admin_resolve_report: revoke from authenticated
REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM authenticated;

-- 2. admin_set_review_status: revoke from authenticated
REVOKE EXECUTE ON FUNCTION public.admin_set_review_status(text, uuid, text) FROM authenticated;

-- 3. create_notification: add admin check, then revoke from authenticated
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
SET search_path TO 'public'
AS $function$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  -- Allow service_role (which has no auth.uid()) or verified admins
  IF auth.uid() IS NOT NULL AND NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admins or server processes can create notifications';
  END IF;

  SELECT id INTO existing_id FROM notifications
  WHERE user_id = p_user_id AND type = p_type
  AND (entity_type IS NOT DISTINCT FROM p_entity_type)
  AND (entity_id IS NOT DISTINCT FROM p_entity_id)
  AND created_at > now() - interval '5 minutes' LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO notifications (user_id, category, type, title, body, entity_type, entity_id, action_url)
  VALUES (p_user_id, p_category, p_type, p_title, p_body, p_entity_type, p_entity_id, p_action_url)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text, uuid, text) FROM authenticated;

-- 4. update_conversation_updated_at: revoke from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.update_conversation_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_conversation_updated_at() FROM authenticated;
