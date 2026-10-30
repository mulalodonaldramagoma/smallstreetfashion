-- 015: Fix self-promotion and revoke anon execute
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_requested_role text;
BEGIN
  v_requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  IF v_requested_role = 'admin' THEN v_requested_role := 'customer'; END IF;
  IF v_requested_role NOT IN ('customer', 'seller') THEN v_requested_role := 'customer'; END IF;
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'phone', ''), v_requested_role)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon;

-- 016: Admin SELECT policies on stores and products
DROP POLICY IF EXISTS "stores_admin_select" ON stores;
CREATE POLICY "stores_admin_select" ON stores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
DROP POLICY IF EXISTS "products_admin_select" ON products;
CREATE POLICY "products_admin_select" ON products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));