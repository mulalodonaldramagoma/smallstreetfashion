/*
# Admin User Management Security Fixes

## Overview
Fixes the admin_set_user_role function to use the private.is_admin() allowlist
check instead of profiles.role = 'admin', which was insecure since the profile
role column could be set to 'admin' without going through the allowlist
provisioning mechanism. Also adds a check_is_admin wrapper callable from
Edge Functions that need to verify admin status by user ID.

## Changes

### 1. Fix admin_set_user_role authorization check
- The existing function checked `profiles.role = 'admin'` to authorize the caller.
- This was wrong: admin status is determined by the private.admin_allowlist table,
  not the profiles.role column. A user with role='admin' in profiles but no
  allowlist entry would fail is_admin() but could still change roles.
- Replaced the check with private.is_admin() for consistency with all other
  admin-gated policies and functions.

### 2. Add check_is_admin(uuid) function
- private.is_admin() takes no arguments and uses auth.uid() internally,
  which doesn't work in Edge Function service-role context.
- check_is_admin(p_user_id uuid) wraps the allowlist check for use by
  the admin-users Edge Function to verify the caller's admin status.

### 3. Revoke public execute on check_is_admin
- This function is only callable by service_role (Edge Functions).
- Revoked from PUBLIC, anon, and authenticated to prevent browser access.

## Security
- No RLS policy changes.
- No new tables.
- check_is_admin is SECURITY DEFINER, service-role only.
*/
-- Fix admin_set_user_role to use is_admin() instead of profiles.role
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_target_user_id uuid, p_new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can change user roles.';
  END IF;
  IF p_new_role NOT IN ('customer', 'seller', 'admin') THEN
    RAISE EXCEPTION 'Invalid role.';
  END IF;
  UPDATE profiles SET role = p_new_role, updated_at = now()
  WHERE id = p_target_user_id;
END;
$function$;

-- Add check_is_admin for Edge Function use (takes explicit user_id)
CREATE OR REPLACE FUNCTION public.check_is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'private', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM private.admin_allowlist a
    WHERE a.user_id = p_user_id AND a.revoked_at IS NULL
  );
$function$;

-- Revoke public/anon/authenticated execute on check_is_admin
REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM authenticated;
