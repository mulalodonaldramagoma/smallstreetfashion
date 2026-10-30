-- Batch 6 security audit: add authorization check to create_notification
--
-- Problem: create_notification is a SECURITY DEFINER function callable by any
-- authenticated user via RPC. It accepts p_user_id as a parameter with no
-- internal authorization check, so any signed-in user can send arbitrary
-- notifications to any other user.
--
-- Fix: Add an admin authorization check. Admins and service_role (edge functions
-- using service_role key bypass this check entirely) can still create
-- notifications. Regular customers and sellers cannot call this function
-- directly — they have no legitimate need to.
--
-- This does NOT affect:
-- - Edge functions using the service_role key (they bypass function auth)
-- - Admin-triggered notifications from adminService.ts (admin passes the check)
-- - The deduplication logic (preserved unchanged)

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text DEFAULT NULL::text,
  p_entity_id uuid DEFAULT NULL::uuid,
  p_action_url text DEFAULT NULL::text
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
  -- Authorization: only admins may call this directly.
  -- Service-role callers (edge functions) bypass this check entirely.
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Not authorized to create notifications';
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

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text, uuid, text) TO authenticated;
