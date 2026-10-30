/*
# Add seller SELECT policy on orders table

## Problem
The `orders` table had SELECT policies for admins (`orders_admin_select`) and
customers viewing their own orders (`orders_select_own`), but NO policy allowing
a seller to read an order that contains items from their own store.

As a result, the seller dispatch page could not retrieve delivery/order data.
The `deliveries_select_seller` RLS policy subqueries `orders`, which was
invisible to sellers, so all delivery rows were filtered out — the seller saw
"No deliveries to manage" even though delivery records existed.

## Changes

### 1. New SECURITY DEFINER helper function: `private.is_seller_order(p_order_id uuid)`
- Returns `true` if the authenticated user owns a store that has at least one
  order item in the given order.
- Runs as `SECURITY DEFINER` with an explicit `search_path = public, private`
  to avoid RLS recursion: a plain subquery from `orders` → `order_items` would
  cycle because `order_items_select_own` subqueries `orders`.
- Only exposes a boolean — does not leak any order, item, or customer data.
- Execution granted to `authenticated` only (not `anon`, not `PUBLIC`).

### 2. New SELECT policy on `orders`: `orders_select_seller`
- `TO authenticated`
- `USING (private.is_seller_order(orders.id))`
- Allows a seller to read an order ONLY when one of its order items belongs to
  a store they own.
- Does not grant INSERT, UPDATE, DELETE, or TRUNCATE.

## Privacy considerations
- A seller can now read the order header (customer name, contact, delivery
  address, order number, status, total) for orders containing their store's
  items. This is the minimum needed to fulfil and dispatch deliveries.
- A seller CANNOT read orders that have no items from their store.
- In multi-seller orders, a seller sees the shared order header but only their
  own store's order items (enforced by `order_items_select_seller` which checks
  `stores.seller_id = auth.uid()`).
- The nested `order:orders(...)` join in `fetchSellerDeliveries` now resolves
  for sellers because the `orders_select_seller` policy passes.

## What is NOT changed
- `orders_admin_select` and `orders_select_own` are preserved.
- `deliveries_select_seller` and `deliveries_update_seller` now work because
  their `orders` subquery resolves via the new policy.
- No new delivery records are created.
- No payment, refund, earnings, reconciliation, or inventory logic is touched.
*/

-- ============================================================
-- 1. SECURITY DEFINER helper: private.is_seller_order
-- ============================================================
-- Breaks the RLS recursion cycle:
--   orders policy -> order_items -> orders (would cycle)
-- By running as SECURITY DEFINER, the internal query bypasses RLS,
-- so no recursion occurs. Only a boolean is returned.

CREATE OR REPLACE FUNCTION private.is_seller_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN stores s ON s.id = oi.store_id
    WHERE oi.order_id = p_order_id
      AND s.seller_id = auth.uid()
  );
$$;

-- Restrict execution to authenticated only (not anon, not PUBLIC)
REVOKE EXECUTE ON FUNCTION private.is_seller_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_seller_order(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_seller_order(uuid) TO authenticated;

-- ============================================================
-- 2. Add seller SELECT policy on orders
-- ============================================================
DROP POLICY IF EXISTS "orders_select_seller" ON orders;

CREATE POLICY "orders_select_seller"
ON orders FOR SELECT
TO authenticated
USING (private.is_seller_order(orders.id));
