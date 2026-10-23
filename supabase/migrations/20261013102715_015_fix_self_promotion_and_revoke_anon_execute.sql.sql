/*
# Fix Self-Promotion Vulnerability and Revoke Anon EXECUTE on SECURITY DEFINER Functions

## Overview
Closes a critical security hole where any user could self-promote to admin by
passing `role: 'admin'` in their signup metadata. Also revokes EXECUTE from the
anon role on three SECURITY DEFINER functions flagged by the database linter.

## Security Changes

1. **handle_new_user trigger function** — rewritten to NEVER trust the
   user-supplied `role` from `raw_user_meta_data`. The role is hardcoded to
   `'customer'`. This means every new signup starts as a customer, and only an
   existing admin (via `admin_set_user_role`) or the service role can promote
   them. Sellers must also be promoted by an admin after signing up as a
   customer, OR the function can be updated later to allow 'seller' — but never
   'admin'.

   Actually, to preserve the existing seller signup flow (the registration form
   lets users pick "Seller"), we allow 'seller' from metadata but explicitly
   reject 'admin'. This way the signup form still works, but nobody can
   self-promote to admin.

2. **Revoke EXECUTE from anon** on:
   - `handle_new_user` — only invoked by the auth trigger, never by clients
   - `decrement_stock` — should only be called by authenticated checkout flow
   - `generate_order_number` — should only be called by authenticated checkout

3. **Revoke EXECUTE from authenticated on handle_new_user** — this function is
   a trigger target, not meant to be called via RPC by any user.

## Notes
- The `enforce_role_immutable` trigger (from migration 014) still guards UPDATE
  on profiles.role, blocking non-admins from changing roles after signup.
- The `admin_set_user_role` SECURITY DEFINER function remains the only sanctioned
  way for an admin to change another user's role.
*/

-- 1. Fix handle_new_user: reject 'admin' from user metadata, allow 'customer' and 'seller'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role text;
BEGIN
  v_requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');

  -- Never allow self-promotion to admin
  IF v_requested_role = 'admin' THEN
    v_requested_role := 'customer';
  END IF;

  -- Only customer and seller are valid at signup; admin is never allowed
  IF v_requested_role NOT IN ('customer', 'seller') THEN
    v_requested_role := 'customer';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_requested_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Revoke EXECUTE from anon on all three SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM anon;

REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon;
