/*
# Fix role assignment at signup and restore admin detection

## Problems
1. **Every new user is created as `customer` regardless of their choice.**
   The `handle_new_user()` trigger hardcodes
   `role = 'customer'` in both the INSERT and the ON CONFLICT update,
   and never reads the `role` value the user selected at registration
   (which arrives in `raw_user_meta_data->>'role'`). A user who picks
   "Seller" at signup still lands as a customer, so they never get
   access to the seller dashboard.

2. **Admin dashboard never appears, even for real admins.** The
   frontend's AuthContext calls `supabase.rpc('is_current_admin')`,
   but no function named `is_current_admin` exists in the `public`
   schema. The RPC errors every time, so `isAdmin` is always `false`
   and the admin entry point is hidden for everyone — including the
   provisioned admin user.

## Fixes
1. Rewrite `handle_new_user()` to read the requested role from
   `raw_user_meta_data->>'role'`, defaulting to `customer` when
   missing. The role is **clamped** to `customer` or `seller` only —
   a value of `admin` (or anything else) is silently downgraded to
   `customer`. Admin accounts are never created by self-signup; they
   can only be provisioned server-side via `admin_set_user_role` or a
   migration. This keeps role escalation out of user-controlled
   metadata while honoring the legitimate customer/seller choice.

2. Create `public.is_current_admin()` as a thin SECURITY DEFINER
   wrapper around the existing `private.is_admin()` check. Grant
   EXECUTE to `authenticated` only (not `anon`), so the frontend RPC
   resolves and returns true for real admins. The function reads the
   caller's own profile role via `auth.uid()` — no new access is
   granted; it only exposes the existing check through a callable
   name.

## Security
- No destructive changes. No data is modified.
- Self-signup can still only produce `customer` or `seller`. Admin
  remains server-provisioned only.
- The new public function is a read-only boolean check; it cannot
  mutate roles or read other users' data.
*/

-- 1. Fix the trigger function so it honors the chosen role (customer
--    or seller) and silently ignores admin/self-escalation attempts.
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
  -- Only customer and seller are assignable at signup. Admin is
  -- server-provisioned only, so any 'admin' (or unknown) value is
  -- safely downgraded to customer.
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

-- 2. Expose admin detection as a public RPC the frontend can call.
--    Wraps the existing private.is_admin() check; returns true only
--    when the caller's profile role is admin.
CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_current_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_current_admin() TO authenticated;
