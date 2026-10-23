/*
# Stage 9: Admin Dashboard — Access Control, Audit Log, RLS, and Admin Promotion

## Overview
Completes the admin access control system:
1. Trigger to prevent non-admin users from changing the role column on profiles
2. Admin audit log table (immutable, admin read/insert only)
3. Admin RLS policies on orders, order_items, profiles, stores, products, categories, payment_transactions
4. admin_set_user_role SECURITY DEFINER function for sanctioned role changes
5. Promotes ramagomamd@outlook.com to admin role

## Security Changes
1. enforce_role_immutable trigger — blocks non-admin, non-service_role users from
   changing profiles.role. Admins can change roles. Service role bypasses.
2. Admin audit log — only admins can read and insert.
3. Admin SELECT policies on orders, order_items, profiles, payment_transactions.
4. Admin UPDATE policies on stores and products (already have admin SELECT from migration 016).
5. Admin INSERT/UPDATE/DELETE on categories.
6. admin_set_user_role function — only callable by authenticated, checks caller is admin.
   Revoked from anon. Not callable via anon key.
7. Promotes the user ramagomamd@outlook.com to admin via service role (bypasses trigger).

## Important Notes
- The enforce_role_immutable trigger allows the service_role to bypass the check
  (current_setting('role', true) = 'service_role') so migrations can still set roles.
- The admin promotion runs as service_role (superuser context during migration),
  which the trigger allows because there is no JWT context.
*/

-- 1. Trigger to prevent non-admin role changes on profiles
CREATE OR REPLACE FUNCTION enforce_role_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_auth_uid text;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_auth_uid := current_setting('request.jwt.claims', true)::json->>'sub';
  IF v_auth_uid IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT role INTO v_caller_role FROM profiles WHERE id = v_auth_uid::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_role := NULL;
  END;

  IF v_caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only administrators can change user roles.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_immutable ON profiles;
CREATE TRIGGER profiles_role_immutable
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_role_immutable();

-- 2. Admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  target_name text,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_select" ON admin_audit_log;
CREATE POLICY "audit_log_admin_select"
  ON admin_audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "audit_log_admin_insert" ON admin_audit_log;
CREATE POLICY "audit_log_admin_insert"
  ON admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON admin_audit_log(actor_id);

-- 3. Admin RLS policies on remaining tables

-- orders: admin SELECT
DROP POLICY IF EXISTS "orders_admin_select" ON orders;
CREATE POLICY "orders_admin_select"
  ON orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- order_items: admin SELECT
DROP POLICY IF EXISTS "order_items_admin_select" ON order_items;
CREATE POLICY "order_items_admin_select"
  ON order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- profiles: admin SELECT (sees all profiles)
DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;
CREATE POLICY "profiles_admin_select"
  ON profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- stores: admin UPDATE (can activate/verify/deactivate stores)
DROP POLICY IF EXISTS "stores_admin_update" ON stores;
CREATE POLICY "stores_admin_update"
  ON stores FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- products: admin UPDATE (can hide/restore products)
DROP POLICY IF EXISTS "products_admin_update" ON products;
CREATE POLICY "products_admin_update"
  ON products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- categories: admin INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "categories_admin_insert" ON categories;
CREATE POLICY "categories_admin_insert"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "categories_admin_update" ON categories;
CREATE POLICY "categories_admin_update"
  ON categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "categories_admin_delete" ON categories;
CREATE POLICY "categories_admin_delete"
  ON categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- payment_transactions: admin SELECT
DROP POLICY IF EXISTS "payment_tx_admin_select" ON payment_transactions;
CREATE POLICY "payment_tx_admin_select"
  ON payment_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- product_images: admin SELECT (sees images for inactive products too)
DROP POLICY IF EXISTS "product_images_admin_read" ON product_images;
CREATE POLICY "product_images_admin_read"
  ON product_images FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 4. admin_set_user_role function
CREATE OR REPLACE FUNCTION admin_set_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators can change user roles.';
  END IF;
  IF p_new_role NOT IN ('customer', 'seller', 'admin') THEN
    RAISE EXCEPTION 'Invalid role.';
  END IF;
  UPDATE profiles SET role = p_new_role, updated_at = now()
  WHERE id = p_target_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_set_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION admin_set_user_role(uuid, text) TO authenticated;

-- 5. Promote ramagomamd@outlook.com to admin
-- Runs during migration (superuser context, no JWT — trigger allows this)
UPDATE profiles SET role = 'admin', updated_at = now()
WHERE id IN (
  SELECT p.id FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = 'ramagomamd@outlook.com'
);
