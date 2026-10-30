-- 021: Fix recursive admin policies with private.is_admin() helper
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role = 'admin');
$$;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin() FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

DROP POLICY IF EXISTS "audit_log_admin_insert" ON admin_audit_log;
CREATE POLICY "audit_log_admin_insert" ON admin_audit_log FOR INSERT TO authenticated WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "audit_log_admin_select" ON admin_audit_log;
CREATE POLICY "audit_log_admin_select" ON admin_audit_log FOR SELECT TO authenticated USING (private.is_admin());

DROP POLICY IF EXISTS "categories_admin_delete" ON categories;
CREATE POLICY "categories_admin_delete" ON categories FOR DELETE TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "categories_admin_insert" ON categories;
CREATE POLICY "categories_admin_insert" ON categories FOR INSERT TO authenticated WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "categories_admin_update" ON categories;
CREATE POLICY "categories_admin_update" ON categories FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "courier_providers_admin_delete" ON courier_providers;
CREATE POLICY "courier_providers_admin_delete" ON courier_providers FOR DELETE TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "courier_providers_admin_insert" ON courier_providers;
CREATE POLICY "courier_providers_admin_insert" ON courier_providers FOR INSERT TO authenticated WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "courier_providers_admin_update" ON courier_providers;
CREATE POLICY "courier_providers_admin_update" ON courier_providers FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "delivery_methods_admin_delete" ON delivery_methods;
CREATE POLICY "delivery_methods_admin_delete" ON delivery_methods FOR DELETE TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "delivery_methods_admin_insert" ON delivery_methods;
CREATE POLICY "delivery_methods_admin_insert" ON delivery_methods FOR INSERT TO authenticated WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "delivery_methods_admin_update" ON delivery_methods;
CREATE POLICY "delivery_methods_admin_update" ON delivery_methods FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "delivery_zones_admin_delete" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_delete" ON delivery_zones FOR DELETE TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "delivery_zones_admin_insert" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_insert" ON delivery_zones FOR INSERT TO authenticated WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "delivery_zones_admin_update" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_update" ON delivery_zones FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "deliveries_select_admin" ON deliveries;
CREATE POLICY "deliveries_select_admin" ON deliveries FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "deliveries_update_admin" ON deliveries;
CREATE POLICY "deliveries_update_admin" ON deliveries FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "deliveries_delete_admin" ON deliveries;
CREATE POLICY "deliveries_delete_admin" ON deliveries FOR DELETE TO authenticated USING (private.is_admin());

DROP POLICY IF EXISTS "dsh_select_admin" ON delivery_status_history;
CREATE POLICY "dsh_select_admin" ON delivery_status_history FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "dsh_insert_admin" ON delivery_status_history;
CREATE POLICY "dsh_insert_admin" ON delivery_status_history FOR INSERT TO authenticated WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "dsh_delete_admin" ON delivery_status_history;
CREATE POLICY "dsh_delete_admin" ON delivery_status_history FOR DELETE TO authenticated USING (private.is_admin());

DROP POLICY IF EXISTS "orders_admin_select" ON orders;
CREATE POLICY "orders_admin_select" ON orders FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "order_items_admin_select" ON order_items;
CREATE POLICY "order_items_admin_select" ON order_items FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "payment_tx_admin_select" ON payment_transactions;
CREATE POLICY "payment_tx_admin_select" ON payment_transactions FOR SELECT TO authenticated USING (private.is_admin());

DROP POLICY IF EXISTS "stores_admin_read" ON stores;
CREATE POLICY "stores_admin_read" ON stores FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "stores_admin_select" ON stores;
CREATE POLICY "stores_admin_select" ON stores FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "stores_admin_update" ON stores;
CREATE POLICY "stores_admin_update" ON stores FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "products_admin_read" ON products;
CREATE POLICY "products_admin_read" ON products FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "products_admin_select" ON products;
CREATE POLICY "products_admin_select" ON products FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "products_admin_update" ON products;
CREATE POLICY "products_admin_update" ON products FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "product_images_admin_read" ON product_images;
CREATE POLICY "product_images_admin_read" ON product_images FOR SELECT TO authenticated USING (private.is_admin());

DROP POLICY IF EXISTS "shipments_select_admin" ON shipments;
CREATE POLICY "shipments_select_admin" ON shipments FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "shipments_insert_admin" ON shipments;
CREATE POLICY "shipments_insert_admin" ON shipments FOR INSERT TO authenticated WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "shipments_update_admin" ON shipments;
CREATE POLICY "shipments_update_admin" ON shipments FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "tracking_events_select_admin" ON shipment_tracking_events;
CREATE POLICY "tracking_events_select_admin" ON shipment_tracking_events FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "tracking_events_insert_admin" ON shipment_tracking_events;
CREATE POLICY "tracking_events_insert_admin" ON shipment_tracking_events FOR INSERT TO authenticated WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;
CREATE POLICY "profiles_admin_select" ON profiles FOR SELECT TO authenticated USING (private.is_admin());
