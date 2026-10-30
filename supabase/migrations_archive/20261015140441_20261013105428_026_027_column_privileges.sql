-- 026: Column-level privilege tightening
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone, updated_at) ON public.profiles TO authenticated;

REVOKE UPDATE ON public.stores FROM authenticated, anon;
GRANT UPDATE (name, slug, description, location, phone, whatsapp, logo_url, banner_url, updated_at) ON public.stores TO authenticated;

REVOKE UPDATE ON public.products FROM authenticated, anon;
GRANT UPDATE (category_id, name, description, sku, price, compare_at_price, stock, sizes, colours, main_image_url, is_active, updated_at) ON public.products TO authenticated;

REVOKE UPDATE ON public.orders FROM authenticated, anon;
REVOKE DELETE ON public.orders FROM authenticated, anon;
REVOKE TRUNCATE ON public.orders FROM authenticated, anon;

REVOKE UPDATE ON public.order_items FROM authenticated, anon;
REVOKE DELETE ON public.order_items FROM authenticated, anon;
REVOKE TRUNCATE ON public.order_items FROM authenticated, anon;

REVOKE UPDATE ON public.payment_transactions FROM authenticated, anon;
REVOKE DELETE ON public.payment_transactions FROM authenticated, anon;
REVOKE TRUNCATE ON public.payment_transactions FROM authenticated, anon;

DROP POLICY IF EXISTS "audit_log_admin_update" ON public.admin_audit_log;
DROP POLICY IF EXISTS "audit_log_admin_delete" ON public.admin_audit_log;
CREATE POLICY "audit_log_admin_update" ON public.admin_audit_log FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "audit_log_admin_delete" ON public.admin_audit_log FOR DELETE TO authenticated USING (false);
REVOKE UPDATE ON public.admin_audit_log FROM authenticated, anon;
REVOKE DELETE ON public.admin_audit_log FROM authenticated, anon;
REVOKE TRUNCATE ON public.admin_audit_log FROM authenticated, anon;

REVOKE UPDATE ON public.delivery_status_history FROM authenticated, anon;
REVOKE TRUNCATE ON public.delivery_status_history FROM authenticated, anon;

REVOKE UPDATE ON public.shipment_tracking_events FROM authenticated, anon;
REVOKE DELETE ON public.shipment_tracking_events FROM authenticated, anon;
REVOKE TRUNCATE ON public.shipment_tracking_events FROM authenticated, anon;

REVOKE UPDATE ON public.shipments FROM authenticated, anon;
GRANT UPDATE (tracking_number, tracking_url, status, cancelled_at, cancelled_by, updated_at) ON public.shipments TO authenticated;

-- 027: Revoke INSERT on product moderation columns
REVOKE INSERT ON public.products FROM authenticated, anon;
GRANT INSERT (store_id, category_id, name, description, sku, price, compare_at_price, stock, sizes, colours, main_image_url, is_active) ON public.products TO authenticated;
