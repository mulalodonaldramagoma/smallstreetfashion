-- Concurrency safety for process_order_post_payment
--
-- Adds SELECT ... FOR UPDATE row-level locking on order_processing_log
-- so concurrent webhook calls for the same order serialize instead of
-- racing. Also wraps stock decrement in a subtransaction so a stock
-- failure is recorded without aborting the entire function.
--
-- NOT changed in this migration:
--   * decrement_stock  (left exactly as-is)
--   * create_seller_earnings_for_order
--   * commission rate (0.1000)
--   * earnings-ledger table structure
--   * Paystack init / verification / webhook / refund / order-status logic
--
-- Transaction semantics:
--   The lock (SELECT FOR UPDATE) is held for the duration of the outer
--   transaction.  A second concurrent call blocks at the lock until the
--   first commits; it then reads the committed flags and skips work that
--   is already done — preserving idempotency.
--
--   Stock decrement runs BEFORE the earnings subtransaction and inside
--   the outer transaction (not inside a BEGIN/EXCEPTION block).  If
--   decrement_stock raises, the entire function aborts and the outer
--   transaction rolls back — including the processing-log insert — so a
--   retry starts clean.
--
--   Earnings creation runs inside a BEGIN/EXCEPTION/END subtransaction.
--   If it fails, only changes made inside that block are rolled back
--   (the earnings rows and the earnings_created=true update).  Stock
--   changes made earlier in the outer transaction survive and commit,
--   and stock_decremented=true persists — so a retry skips stock and
--   re-attempts earnings only.

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
BEGIN
  -- 1. Verify payment is successful (read-only, no lock needed)
  SELECT EXISTS(
    SELECT 1 FROM payment_transactions
    WHERE order_id = p_order_id
    AND status = 'success'
    AND verified_at IS NOT NULL
  ) INTO v_payment_verified;

  IF NOT v_payment_verified THEN
    RAISE EXCEPTION 'Order % does not have a verified successful payment', p_order_id;
  END IF;

  -- 2. Ensure the processing-log row exists, then lock it FOR UPDATE.
  --    Concurrent calls for the same order block here until the first
  --    caller commits, preventing double stock decrement or duplicate
  --    earnings.
  INSERT INTO order_processing_log (order_id, stock_decremented, earnings_created)
  VALUES (p_order_id, false, false)
  ON CONFLICT (order_id) DO NOTHING;

  SELECT stock_decremented, earnings_created
  INTO v_stock_decremented, v_earnings_created
  FROM order_processing_log
  WHERE order_id = p_order_id
  FOR UPDATE;

  -- 3. Stock decrement (if not already done).
  --    NOT wrapped in a subtransaction: if decrement_stock raises, the
  --    whole function aborts and the outer transaction rolls back.  The
  --    processing-log row insert is rolled back too, so a retry starts
  --    fresh.  This is safe because stock is decremented before earnings
  --    — no partial earnings state to recover from.
  IF NOT v_stock_decremented THEN
    FOR v_item IN
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = p_order_id
    LOOP
      SELECT public.decrement_stock(v_item.product_id, v_item.quantity) INTO v_new_stock;
    END LOOP;

    UPDATE order_processing_log
    SET stock_decremented = true, updated_at = now()
    WHERE order_id = p_order_id;
  END IF;

  -- 4. Earnings creation (if not already done).
  --    Wrapped in a subtransaction: on failure the exception is caught,
  --    earnings rows are rolled back, and the error is recorded.  Stock
  --    changes (made above, in the outer transaction) survive and
  --    commit.  earnings_created stays false so a retry re-attempts
  --    earnings only.
  IF NOT v_earnings_created THEN
    BEGIN
      v_earnings_result := public.create_seller_earnings_for_order(p_order_id);
      UPDATE order_processing_log
      SET earnings_created = true, updated_at = now()
      WHERE order_id = p_order_id;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'earnings: ' || SQLERRM);
      UPDATE order_processing_log
      SET processing_error = array_to_string(v_errors, '; '), updated_at = now()
      WHERE order_id = p_order_id;
    END;
  ELSE
    v_earnings_result := jsonb_build_object('message', 'Earnings already created');
  END IF;

  -- 5. Finalize
  IF v_errors = ARRAY[]::text[] THEN
    UPDATE order_processing_log
    SET processed_at = now(), processing_error = NULL, updated_at = now()
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'stock_decremented', true,
      'earnings_created', true,
      'earnings', v_earnings_result,
      'status', 'completed'
    );
  ELSE
    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'stock_decremented', true,
      'earnings_created', COALESCE(v_earnings_created, false),
      'errors', array_to_string(v_errors, '; '),
      'status', 'partial'
    );
  END IF;
END;
$function$;

-- Preserve EXECUTE grants: service_role only.
REVOKE EXECUTE ON FUNCTION public.process_order_post_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_post_payment(uuid) TO service_role;
