/*
# Security Audit: Column-Level Privilege Tightening + Audit Log Protection

## Issues Fixed
1. profiles.role: UPDATE grant allows self-promotion attempt (trigger blocks, but grant should not exist)
2. stores: is_active, is_verified, is_demo columns UPDATE-able by sellers (self-activate/self-verify)
3. products: is_demo, is_featured columns UPDATE-able by sellers (self-feature)
4. orders: status, total, subtotal, delivery_fee columns UPDATE-able (no UPDATE policy, but grants too wide)
5. payment_transactions: status, verified_at, amount columns UPDATE-able (no UPDATE policy, but grants too wide)
6. admin_audit_log: no UPDATE/DELETE policies (RLS denies by default, but explicit is better)
7. delivery_status_history: no UPDATE policy but UPDATE grant exists (immutable history)
8. shipment_tracking_events: UPDATE/DELETE grants exist (immutable tracking)

## Approach
- REVOKE UPDATE on privileged columns, GRANT UPDATE only on user-editable columns
- Add explicit deny policies on admin_audit_log for UPDATE and DELETE
- Revoke unnecessary table-level privileges (TRUNCATE, DELETE, UPDATE on immutable tables)
- Do NOT change any existing RLS policies (no weakening)
- Do NOT drop or alter any data
*/

-- 1. PROFILES: Revoke UPDATE on role column; keep UPDATE on full_name, phone, updated_at
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone, updated_at) ON public.profiles TO authenticated;

-- 2. STORES: Revoke UPDATE on admin-only columns; keep seller-editable columns
REVOKE UPDATE ON public.stores FROM authenticated, anon;
GRANT UPDATE (
  name, slug, description, location, phone, whatsapp,
  logo_url, banner_url, updated_at
) ON public.stores TO authenticated;

-- 3. PRODUCTS: Revoke UPDATE on admin/moderation columns; keep seller-editable columns
-- Note: is_active is kept because sellers can toggle their own products active/inactive
REVOKE UPDATE ON public.products FROM authenticated, anon;
GRANT UPDATE (
  category_id, name, description, sku, price, compare_at_price,
  stock, sizes, colours, main_image_url, is_active, updated_at
) ON public.products TO authenticated;

-- 4. ORDERS: Revoke UPDATE and DELETE — orders are created by edge function (service role),
-- status changes happen via edge function (service role), not client
REVOKE UPDATE ON public.orders FROM authenticated, anon;
REVOKE DELETE ON public.orders FROM authenticated, anon;
REVOKE TRUNCATE ON public.orders FROM authenticated, anon;

-- 5. ORDER_ITEMS: Revoke UPDATE and DELETE — managed by edge function only
REVOKE UPDATE ON public.order_items FROM authenticated, anon;
REVOKE DELETE ON public.order_items FROM authenticated, anon;
REVOKE TRUNCATE ON public.order_items FROM authenticated, anon;

-- 6. PAYMENT_TRANSACTIONS: Revoke UPDATE and DELETE — managed by edge function only
REVOKE UPDATE ON public.payment_transactions FROM authenticated, anon;
REVOKE DELETE ON public.payment_transactions FROM authenticated, anon;
REVOKE TRUNCATE ON public.payment_transactions FROM authenticated, anon;

-- 7. ADMIN_AUDIT_LOG: Add explicit UPDATE and DELETE deny policies
DROP POLICY IF EXISTS "audit_log_admin_update" ON public.admin_audit_log;
DROP POLICY IF EXISTS "audit_log_admin_delete" ON public.admin_audit_log;
CREATE POLICY "audit_log_admin_update" ON public.admin_audit_log
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "audit_log_admin_delete" ON public.admin_audit_log
  FOR DELETE TO authenticated
  USING (false);

-- Also revoke unnecessary privileges on audit log
REVOKE UPDATE ON public.admin_audit_log FROM authenticated, anon;
REVOKE DELETE ON public.admin_audit_log FROM authenticated, anon;
REVOKE TRUNCATE ON public.admin_audit_log FROM authenticated, anon;

-- 8. DELIVERY_STATUS_HISTORY: Revoke UPDATE — history is immutable
REVOKE UPDATE ON public.delivery_status_history FROM authenticated, anon;
REVOKE TRUNCATE ON public.delivery_status_history FROM authenticated, anon;

-- 9. SHIPMENT_TRACKING_EVENTS: Revoke UPDATE and DELETE — immutable tracking
REVOKE UPDATE ON public.shipment_tracking_events FROM authenticated, anon;
REVOKE DELETE ON public.shipment_tracking_events FROM authenticated, anon;
REVOKE TRUNCATE ON public.shipment_tracking_events FROM authenticated, anon;

-- 10. SHIPMENTS: Revoke UPDATE on all, re-grant only seller-editable columns
-- Sellers need: status, tracking_number, tracking_url, cancelled_at, cancelled_by
-- Admin needs: all via admin policy (service_role bypasses anyway)
REVOKE UPDATE ON public.shipments FROM authenticated, anon;
GRANT UPDATE (
  tracking_number, tracking_url, status,
  cancelled_at, cancelled_by, updated_at
) ON public.shipments TO authenticated;
