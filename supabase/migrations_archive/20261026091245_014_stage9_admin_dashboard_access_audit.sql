/*
# Stage 9: Admin Dashboard — Access Control, Audit Log, and RLS

Creates the audit log table, adds admin RLS policies, prevents self-promotion
via a trigger, and creates admin_set_user_role function.

NOTE: The hardcoded user promotion from the original migration has been removed.
Admin provisioning will be handled via the admin allowlist in a later migration.
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
  -- service_role bypasses this check entirely
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Get auth.uid() safely
  v_auth_uid := current_setting('request.jwt.claims', true)::json->>'sub';
  IF v_auth_uid IS NULL THEN
    -- No JWT context (migration running as superuser) — allow
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
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "audit_log_admin_insert" ON admin_audit_log;
CREATE POLICY "audit_log_admin_insert"
  ON admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON admin_audit_log(actor_id);

GRANT SELECT, INSERT ON admin_audit_log TO authenticated;

-- 3. Admin RLS policies

DROP POLICY IF EXISTS "orders_admin_select" ON orders;
CREATE POLICY "orders_admin_select"
  ON orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "order_items_admin_select" ON order_items;
CREATE POLICY "order_items_admin_select"
  ON order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;
CREATE POLICY "profiles_admin_select"
  ON profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "stores_admin_update" ON stores;
CREATE POLICY "stores_admin_update"
  ON stores FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "products_admin_update" ON products;
CREATE POLICY "products_admin_update"
  ON products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

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

DROP POLICY IF EXISTS "payment_tx_admin_select" ON payment_transactions;
CREATE POLICY "payment_tx_admin_select"
  ON payment_transactions FOR SELECT TO authenticated
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