-- Concurrency safety for process_order_post_payment
-- Adds SELECT ... FOR UPDATE row-level locking on order_processing_log

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
  SELECT EXISTS(
    SELECT 1 FROM payment_transactions
    WHERE order_id = p_order_id
    AND status = 'success'
    AND verified_at IS NOT NULL
  ) INTO v_payment_verified;

  IF NOT v_payment_verified THEN
    RAISE EXCEPTION 'Order % does not have a verified successful payment', p_order_id;
  END IF;

  INSERT INTO order_processing_log (order_id, stock_decremented, earnings_created)
  VALUES (p_order_id, false, false)
  ON CONFLICT (order_id) DO NOTHING;

  SELECT stock_decremented, earnings_created
  INTO v_stock_decremented, v_earnings_created
  FROM order_processing_log
  WHERE order_id = p_order_id
  FOR UPDATE;

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

REVOKE EXECUTE ON FUNCTION public.process_order_post_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_post_payment(uuid) TO service_role;