/*
# Fix Concurrency Race and Stock Safety in Post-Payment Processing

## Purpose
Fixes three issues identified in the financial reconciliation audit:
1. decrement_stock silently floors stock at zero instead of raising an error
2. process_order_post_payment has a race condition allowing concurrent stock double-decrement
3. Exception handling in process_order_post_payment does not properly preserve errors
   or prevent inconsistent state after partial failures

## Changes

### 1. decrement_stock — Safe stock deduction with explicit failure
- Replaced GREATEST(stock - p_quantity, 0) with a conditional UPDATE that only
  fires when stock >= p_quantity.
- If stock is insufficient, raises exception with product ID, available stock,
  and requested quantity.
- No silent floor-at-zero behavior.

### 2. process_order_post_payment — Row-level locking and proper exception handling
- Acquires SELECT ... FOR UPDATE on the order_processing_log row immediately after
  insert-or-get. Serializes concurrent calls for the same order.
- Stock decrement wrapped in BEGIN ... EXCEPTION block with sub-transaction safety.
- Earnings creation wrapped in its own BEGIN ... EXCEPTION block.
- Never marks processed_at when any step failed.

### 3. create_seller_earnings_for_order — No structural changes needed
- Already idempotent (checks existing count, uses ON CONFLICT DO NOTHING).

## Transaction Boundaries
- The function runs as a single SECURITY DEFINER call within one transaction.
- BEGIN ... EXCEPTION blocks create savepoints; caught exceptions roll back
  only changes within that block.
- SELECT ... FOR UPDATE lock is acquired before any stock/earnings work,
  serializing concurrent calls.

## Retry Safety
- stock_decremented=false: stock retried safely (previous failure rolled back all changes)
- stock_decremented=true: stock skipped
- earnings_created=false: earnings retried safely (ON CONFLICT DO NOTHING)
- earnings_created=true: earnings skipped

## Security
- No RLS changes, no permission changes, no credential exposure.
- Commission rate unchanged at 0.1000.

## Important Notes
1. Does NOT process any existing paid orders. Only replaces function definitions.
2. No data deleted, modified, or lost.
*/

-- ============================================================
-- 1. Fix decrement_stock: raise error on insufficient stock
-- ============================================================

CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_quantity integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_stock integer;
  v_new_stock integer;
BEGIN
  -- Read current stock with FOR UPDATE to prevent concurrent modification
  SELECT stock INTO v_current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product %: available %, requested %',
      p_product_id, v_current_stock, p_quantity
      USING ERRCODE = 'P2003';
  END IF;

  v_new_stock := v_current_stock - p_quantity;

  UPDATE products
  SET stock = v_new_stock, updated_at = now()
  WHERE id = p_product_id;

  RETURN v_new_stock;
END;
$function$;

-- ============================================================
-- 2. Fix process_order_post_payment: row lock + proper exception handling
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_order_post_payment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment_verified boolean;
  v_stock_decremented boolean;
  v_earnings_created boolean;
  v_item record;
  v_new_stock integer;
  v_earnings_result jsonb;
  v_errors text[] := ARRAY[]::text[];
  v_stock_error text;
  v_earnings_error text;
BEGIN
  -- 1. Verify payment is successful
  SELECT EXISTS(
    SELECT 1 FROM payment_transactions
    WHERE order_id = p_order_id
    AND status = 'success'
    AND verified_at IS NOT NULL
  ) INTO v_payment_verified;

  IF NOT v_payment_verified THEN
    RAISE EXCEPTION 'Order % does not have a verified successful payment', p_order_id;
  END IF;

  -- 2. Insert processing log if it doesn't exist, then acquire row lock
  --    The ON CONFLICT DO NOTHING handles the race between two concurrent INSERTs.
  --    The SELECT ... FOR UPDATE then serializes: the second call blocks until
  --    the first transaction commits, then reads the committed flags.
  INSERT INTO order_processing_log (order_id, stock_decremented, earnings_created)
  VALUES (p_order_id, false, false)
  ON CONFLICT (order_id) DO NOTHING;

  -- Lock the row for the duration of this transaction. Concurrent calls
  -- for the same order will block here until we commit.
  SELECT stock_decremented, earnings_created
  INTO v_stock_decremented, v_earnings_created
  FROM order_processing_log
  WHERE order_id = p_order_id
  FOR UPDATE;

  -- 3. Stock decrement (if not already done)
  --    Wrapped in a sub-transaction (BEGIN/EXCEPTION/END) so that if any
  --    item fails to decrement, ALL stock changes in this block roll back
  --    to the savepoint. This prevents partial decrements from persisting.
  IF NOT v_stock_decremented THEN
    BEGIN
      FOR v_item IN
        SELECT product_id, quantity
        FROM order_items
        WHERE order_id = p_order_id
      LOOP
        SELECT public.decrement_stock(v_item.product_id, v_item.quantity) INTO v_new_stock;
      END LOOP;

      -- All items decremented successfully — mark the flag
      UPDATE order_processing_log
      SET stock_decremented = true, updated_at = now()
      WHERE order_id = p_order_id;

      v_stock_decremented := true;
    EXCEPTION WHEN OTHERS THEN
      v_stock_error := 'stock: ' || SQLERRM;
      v_errors := array_append(v_errors, v_stock_error);

      -- Record the error but do NOT set stock_decremented = true.
      -- The sub-transaction savepoint has already rolled back all stock changes,
      -- so a retry will safely re-attempt all items.
      UPDATE order_processing_log
      SET processing_error = array_to_string(v_errors, '; '), updated_at = now()
      WHERE order_id = p_order_id;
    END;
  END IF;

  -- 4. Earnings creation (if not already done)
  --    Wrapped in its own sub-transaction. If it fails, earnings_created
  --    stays false and the error is recorded. The unique constraint on
  --    seller_earnings(order_item_id) plus ON CONFLICT DO NOTHING in
  --    create_seller_earnings_for_order makes retry safe.
  IF NOT v_earnings_created THEN
    BEGIN
      v_earnings_result := public.create_seller_earnings_for_order(p_order_id);

      UPDATE order_processing_log
      SET earnings_created = true, updated_at = now()
      WHERE order_id = p_order_id;

      v_earnings_created := true;
    EXCEPTION WHEN OTHERS THEN
      v_earnings_error := 'earnings: ' || SQLERRM;
      v_errors := array_append(v_errors, v_earnings_error);

      UPDATE order_processing_log
      SET processing_error = array_to_string(v_errors, '; '), updated_at = now()
      WHERE order_id = p_order_id;
    END;
  ELSE
    v_earnings_result := jsonb_build_object('message', 'Earnings already created');
  END IF;

  -- 5. Finalize: only mark as fully processed if BOTH steps succeeded
  IF array_length(v_errors, 1) IS NULL THEN
    -- No errors — both steps completed
    UPDATE order_processing_log
    SET processed_at = now(), processing_error = NULL, updated_at = now()
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'stock_decremented', v_stock_decremented,
      'earnings_created', v_earnings_created,
      'earnings', v_earnings_result,
      'status', 'completed'
    );
  ELSE
    -- One or more steps failed — return partial status with error details
    -- processed_at stays NULL so the order can be retried
    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'stock_decremented', v_stock_decremented,
      'earnings_created', v_earnings_created,
      'errors', array_to_string(v_errors, '; '),
      'status', 'partial'
    );
  END IF;
END;
$function$;

-- ============================================================
-- 3. create_seller_earnings_for_order — No structural changes
--    The function is already idempotent. Re-created to ensure
--    it's in sync with the updated process_order_post_payment.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_seller_earnings_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_exists boolean;
  v_payment_verified boolean;
  v_existing_count integer;
  v_commission_rate numeric(5,4) := 0.1000;
  v_commission_amount numeric(12,2);
  v_net_earnings numeric(12,2);
  v_created_count integer := 0;
  v_total_net numeric(12,2) := 0;
  item_rec record;
BEGIN
  -- 1. Verify the order exists
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- 2. Verify the order has a successful payment
  SELECT EXISTS(
    SELECT 1 FROM payment_transactions
    WHERE order_id = p_order_id
    AND status = 'success'
    AND verified_at IS NOT NULL
  ) INTO v_payment_verified;
  IF NOT v_payment_verified THEN
    RAISE EXCEPTION 'Order % does not have a verified successful payment', p_order_id;
  END IF;

  -- 3. Check if earnings already exist (idempotent)
  SELECT count(*) INTO v_existing_count
  FROM seller_earnings
  WHERE order_id = p_order_id;

  IF v_existing_count > 0 THEN
    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'created_count', 0,
      'existing_count', v_existing_count,
      'message', 'Earnings already exist for this order'
    );
  END IF;

  -- 4. Fetch order items joined with stores to get seller_id
  FOR item_rec IN
    SELECT
      oi.id AS order_item_id,
      oi.store_id,
      oi.line_total,
      s.seller_id
    FROM order_items oi
    JOIN stores s ON s.id = oi.store_id
    WHERE oi.order_id = p_order_id
  LOOP
    -- Validate the store has a valid seller
    IF item_rec.seller_id IS NULL THEN
      RAISE EXCEPTION 'Store % on order % has no seller assigned', item_rec.store_id, p_order_id;
    END IF;

    -- Calculate commission and net using exact decimal arithmetic
    v_commission_amount := ROUND(item_rec.line_total * v_commission_rate, 2);
    v_net_earnings := item_rec.line_total - v_commission_amount;

    -- Insert with ON CONFLICT DO NOTHING for concurrent safety
    INSERT INTO seller_earnings (
      seller_id, store_id, order_id, order_item_id,
      gross_amount, commission_rate, commission_amount, net_earnings,
      status
    ) VALUES (
      item_rec.seller_id, item_rec.store_id, p_order_id, item_rec.order_item_id,
      item_rec.line_total, v_commission_rate, v_commission_amount, v_net_earnings,
      'pending'
    )
    ON CONFLICT (order_item_id) DO NOTHING;

    v_created_count := v_created_count + 1;
    v_total_net := v_total_net + v_net_earnings;
  END LOOP;

  IF v_created_count = 0 THEN
    RAISE EXCEPTION 'No eligible order items found for order %', p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'created_count', v_created_count,
    'total_net_earnings', v_total_net,
    'commission_rate', v_commission_rate,
    'message', 'Earnings created successfully'
  );
END;
$function$;

-- ============================================================
-- 4. Verify function permissions are preserved
-- ============================================================

-- Re-grant EXECUTE only to service_role (and postgres implicitly has it)
-- This is idempotent — if already granted, it's a no-op.
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_order_post_payment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_order_post_payment(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) TO service_role;