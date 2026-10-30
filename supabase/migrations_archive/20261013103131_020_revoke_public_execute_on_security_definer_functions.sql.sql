/*
# Fix: Revoke EXECUTE from anon/PUBLIC on all SECURITY DEFINER functions

## Problem
Supabase grants EXECUTE on all public-schema functions to PUBLIC by default.
Previous REVOKE FROM anon statements had no effect because the PUBLIC grant
still covers the anon and authenticated roles.

## Fix
For each SECURITY DEFINER function:
1. REVOKE EXECUTE FROM PUBLIC (removes the default blanket grant)
2. REVOKE EXECUTE FROM anon (explicit, in case of direct grants)
3. GRANT EXECUTE only to the roles that should have it

## Access matrix
- handle_new_user: NO user role (trigger only, service_role runs it)
- enforce_role_immutable: NO user role (trigger only)
- decrement_stock: authenticated only (called during checkout)
- generate_order_number: authenticated only (called during checkout)
- insert_tracking_event: service_role only (edge functions)
- admin_set_user_role: authenticated only (admin checks caller role inside)
*/

-- handle_new_user: trigger-only, no client access
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- enforce_role_immutable: trigger-only, no client access
REVOKE EXECUTE ON FUNCTION public.enforce_role_immutable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_role_immutable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_role_immutable() FROM authenticated;

-- decrement_stock: authenticated only (checkout flow)
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO authenticated;

-- generate_order_number: authenticated only (checkout flow)
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;

-- insert_tracking_event: service_role only (edge functions)
REVOKE EXECUTE ON FUNCTION public.insert_tracking_event(uuid, text, text, text, timestamptz, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_tracking_event(uuid, text, text, text, timestamptz, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_tracking_event(uuid, text, text, text, timestamptz, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.insert_tracking_event(uuid, text, text, text, timestamptz, text, jsonb) TO service_role;

-- admin_set_user_role: authenticated only (function checks admin role internally)
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
