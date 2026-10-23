/*
# Add Safe Current-Administrator Check

## Overview
Adds a boolean-only function used by the browser to confirm that the signed-in
session is explicitly allowlisted as an administrator.

## Security Changes
- The function exposes only true/false, never profile or allowlist data.
- It delegates to the private allowlist-backed check.
- Anonymous users cannot execute it.

## Important Notes
- This is a session check, not an admin provisioning method.
- Provisioning remains restricted to the private service-role function.
*/

CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.is_admin();
$$;

REVOKE ALL ON FUNCTION public.is_current_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_current_admin() TO authenticated;
