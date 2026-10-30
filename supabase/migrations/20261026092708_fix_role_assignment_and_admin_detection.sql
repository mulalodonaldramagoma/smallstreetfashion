-- Fix role assignment at signup and restore admin detection

-- 1. Fix the trigger function so it honors the chosen role (customer or seller)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requested_role text;
  v_role text;
BEGIN
  v_requested_role := lower(coalesce(NEW.raw_user_meta_data->>'role', 'customer'));
  IF v_requested_role = 'seller' THEN
    v_role := 'seller';
  ELSE
    v_role := 'customer';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- 2. Restore is_current_admin as a public RPC the frontend can call.
--    Uses the allowlist-based private.is_admin() check (established in Batch 1B).
CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.is_admin();
$function$;

REVOKE EXECUTE ON FUNCTION public.is_current_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_current_admin() TO authenticated;