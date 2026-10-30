CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_quantity integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_current_stock integer; v_new_stock integer;
BEGIN
  SELECT stock INTO v_current_stock FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product % not found', p_product_id USING ERRCODE = 'P0002'; END IF;
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product %: available %, requested %', p_product_id, v_current_stock, p_quantity USING ERRCODE = 'P2003';
  END IF;
  v_new_stock := v_current_stock - p_quantity;
  UPDATE products SET stock = v_new_stock, updated_at = now() WHERE id = p_product_id;
  RETURN v_new_stock;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_order_post_payment(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_payment_verified boolean; v_stock_decremented boolean; v_earnings_created boolean;
  v_item record; v_new_stock integer; v_earnings_result jsonb;
  v_errors text[] := ARRAY[]::text[]; v_stock_error text; v_earnings_error text;
BEGIN
  SELECT EXISTS(SELECT 1 FROM payment_transactions WHERE order_id = p_order_id AND status = 'success' AND verified_at IS NOT NULL) INTO v_payment_verified;
  IF NOT v_payment_verified THEN RAISE EXCEPTION 'Order % does not have a verified successful payment', p_order_id; END IF;
  INSERT INTO order_processing_log (order_id, stock_decremented, earnings_created) VALUES (p_order_id, false, false) ON CONFLICT (order_id) DO NOTHING;
  SELECT stock_decremented, earnings_created INTO v_stock_decremented, v_earnings_created FROM order_processing_log WHERE order_id = p_order_id FOR UPDATE;

  IF NOT v_stock_decremented THEN
    BEGIN
      FOR v_item IN SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id LOOP
        SELECT public.decrement_stock(v_item.product_id, v_item.quantity) INTO v_new_stock;
      END LOOP;
      UPDATE order_processing_log SET stock_decremented = true, updated_at = now() WHERE order_id = p_order_id;
      v_stock_decremented := true;
    EXCEPTION WHEN OTHERS THEN
      v_stock_error := 'stock: ' || SQLERRM;
      v_errors := array_append(v_errors, v_stock_error);
      UPDATE order_processing_log SET processing_error = array_to_string(v_errors, '; '), updated_at = now() WHERE order_id = p_order_id;
    END;
  END IF;

  IF NOT v_earnings_created THEN
    BEGIN
      v_earnings_result := public.create_seller_earnings_for_order(p_order_id);
      UPDATE order_processing_log SET earnings_created = true, updated_at = now() WHERE order_id = p_order_id;
      v_earnings_created := true;
    EXCEPTION WHEN OTHERS THEN
      v_earnings_error := 'earnings: ' || SQLERRM;
      v_errors := array_append(v_errors, v_earnings_error);
      UPDATE order_processing_log SET processing_error = array_to_string(v_errors, '; '), updated_at = now() WHERE order_id = p_order_id;
    END;
  ELSE
    v_earnings_result := jsonb_build_object('message', 'Earnings already created');
  END IF;

  IF array_length(v_errors, 1) IS NULL THEN
    UPDATE order_processing_log SET processed_at = now(), processing_error = NULL, updated_at = now() WHERE order_id = p_order_id;
    RETURN jsonb_build_object('order_id', p_order_id, 'stock_decremented', v_stock_decremented, 'earnings_created', v_earnings_created, 'earnings', v_earnings_result, 'status', 'completed');
  ELSE
    RETURN jsonb_build_object('order_id', p_order_id, 'stock_decremented', v_stock_decremented, 'earnings_created', v_earnings_created, 'errors', array_to_string(v_errors, '; '), 'status', 'partial');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_seller_earnings_for_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_order_exists boolean; v_payment_verified boolean; v_existing_count integer;
  v_commission_rate numeric(5,4) := 0.1000; v_commission_amount numeric(12,2);
  v_net_earnings numeric(12,2); v_created_count integer := 0; v_total_net numeric(12,2) := 0;
  item_rec record;
BEGIN
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;
  SELECT EXISTS(SELECT 1 FROM payment_transactions WHERE order_id = p_order_id AND status = 'success' AND verified_at IS NOT NULL) INTO v_payment_verified;
  IF NOT v_payment_verified THEN RAISE EXCEPTION 'Order % does not have a verified successful payment', p_order_id; END IF;
  SELECT count(*) INTO v_existing_count FROM seller_earnings WHERE order_id = p_order_id;
  IF v_existing_count > 0 THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'created_count', 0, 'existing_count', v_existing_count, 'message', 'Earnings already exist for this order');
  END IF;
  FOR item_rec IN SELECT oi.id AS order_item_id, oi.store_id, oi.line_total, s.seller_id FROM order_items oi JOIN stores s ON s.id = oi.store_id WHERE oi.order_id = p_order_id LOOP
    IF item_rec.seller_id IS NULL THEN RAISE EXCEPTION 'Store % on order % has no seller assigned', item_rec.store_id, p_order_id; END IF;
    v_commission_amount := ROUND(item_rec.line_total * v_commission_rate, 2);
    v_net_earnings := item_rec.line_total - v_commission_amount;
    INSERT INTO seller_earnings (seller_id, store_id, order_id, order_item_id, gross_amount, commission_rate, commission_amount, net_earnings, status)
    VALUES (item_rec.seller_id, item_rec.store_id, p_order_id, item_rec.order_item_id, item_rec.line_total, v_commission_rate, v_commission_amount, v_net_earnings, 'pending')
    ON CONFLICT (order_item_id) DO NOTHING;
    v_created_count := v_created_count + 1;
    v_total_net := v_total_net + v_net_earnings;
  END LOOP;
  IF v_created_count = 0 THEN RAISE EXCEPTION 'No eligible order items found for order %', p_order_id; END IF;
  RETURN jsonb_build_object('order_id', p_order_id, 'created_count', v_created_count, 'total_net_earnings', v_total_net, 'commission_rate', v_commission_rate, 'message', 'Earnings created successfully');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_order_post_payment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_order_post_payment(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) TO service_role;
