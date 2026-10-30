-- Add seller SELECT policy on orders table (Batch 4)
-- Allows sellers to read orders containing items from their own store.
-- Uses a SECURITY DEFINER helper to break RLS recursion.

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

REVOKE EXECUTE ON FUNCTION private.is_seller_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_seller_order(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_seller_order(uuid) TO authenticated;

DROP POLICY IF EXISTS "orders_select_seller" ON orders;

CREATE POLICY "orders_select_seller"
ON orders FOR SELECT
TO authenticated
USING (private.is_seller_order(orders.id));
