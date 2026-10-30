/*
# C1: Fix decrement_stock() — Safe Stock Deduction

## Problem
The original decrement_stock (migration 005) silently floors stock at zero
using GREATEST(stock - p_quantity, 0). This allows overselling: if a product
has 2 units in stock and an order requests 5, the stock goes to 0 instead
of rejecting the order. No row lock is held, so concurrent calls can race.

## Fix
- Validate that p_quantity > 0 (reject zero or negative quantities).
- Lock the product row with SELECT ... FOR UPDATE to prevent concurrent races.
- If the product does not exist, raise an exception.
- If stock is insufficient (stock < p_quantity), raise an exception
  with the product ID, available stock, and requested quantity.
- Only decrement when stock >= p_quantity.
- Return the new stock level (integer), matching the original signature.

## Caller compatibility
- process_order_post_payment (Step 32, concurrency_locking_post_payment)
  calls decrement_stock(product_id, quantity) inside a FOR loop and
  SELECTs the integer return into v_new_stock. This replacement preserves
  the exact signature (uuid, integer) RETURNS integer.
- The caller does NOT wrap stock decrement in a subtransaction; if
  decrement_stock raises, the outer transaction rolls back entirely,
  including the order_processing_log insert. This is the intended
  behavior documented in the Step 32 migration: "a retry starts clean."
- The FOR UPDATE lock inside decrement_stock does not deadlock with the
  FOR UPDATE lock on order_processing_log in the caller because they
  lock rows in different tables.

## Security
- SECURITY DEFINER, search_path = public (unchanged).
- EXECUTE granted to service_role only (matches Step 21 grant pattern).
- REVOKE from PUBLIC, anon, authenticated.
*/

CREATE OR REPLACE FUNCTION public.decrement_stock(
  p_product_id uuid,
  p_quantity integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock integer;
  v_new_stock integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Invalid quantity: % (must be > 0)', p_quantity
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT stock INTO v_current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION
      'INSUFFICIENT_STOCK: product % has % units, order requests %',
      p_product_id, v_current_stock, p_quantity
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE products
  SET stock = stock - p_quantity,
      updated_at = now()
  WHERE id = p_product_id
  RETURNING stock INTO v_new_stock;

  RETURN v_new_stock;
END;
$$;

-- Preserve service_role-only execution (matches Step 21 / 022_to_025 pattern)
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO service_role;
