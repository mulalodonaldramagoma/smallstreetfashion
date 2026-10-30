-- ============================================================
-- Seller Earnings Ledger — Phase 1
-- Creates seller_earnings, order_processing_log tables, and two
-- SECURITY DEFINER functions (service_role only).
-- Commission rate: 0.1000 (10%), stored per-record.
-- Idempotent via unique constraint on order_item_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS seller_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  gross_amount numeric(12,2) NOT NULL,
  commission_rate numeric(5,4) NOT NULL,
  commission_amount numeric(12,2) NOT NULL,
  net_earnings numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_earnings_order_item_unique UNIQUE (order_item_id),
  CONSTRAINT seller_earnings_status_check CHECK (status IN ('pending', 'available', 'paid', 'reversed')),
  CONSTRAINT seller_earnings_amounts_check CHECK (gross_amount >= 0 AND commission_amount >= 0 AND net_earnings >= 0),
  CONSTRAINT seller_earnings_math_check CHECK (net_earnings = gross_amount - commission_amount)
);

CREATE INDEX IF NOT EXISTS idx_seller_earnings_seller ON seller_earnings(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_store ON seller_earnings(store_id);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_order ON seller_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_status ON seller_earnings(status);

ALTER TABLE seller_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_earnings_select_own" ON seller_earnings;
CREATE POLICY "seller_earnings_select_own"
  ON seller_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "seller_earnings_admin_select" ON seller_earnings;
CREATE POLICY "seller_earnings_admin_select"
  ON seller_earnings FOR SELECT
  TO authenticated
  USING (private.is_admin());

CREATE TABLE IF NOT EXISTS order_processing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stock_decremented boolean NOT NULL DEFAULT false,
  earnings_created boolean NOT NULL DEFAULT false,
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_processing_log_order_unique UNIQUE (order_id)
);

ALTER TABLE order_processing_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_processing_log_admin_select" ON order_processing_log;
CREATE POLICY "order_processing_log_admin_select"
  ON order_processing_log FOR SELECT
  TO authenticated
  USING (private.is_admin());

CREATE OR REPLACE FUNCTION public.create_seller_earnings_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM payment_transactions
    WHERE order_id = p_order_id
      AND status = 'success'
      AND verified_at IS NOT NULL
  ) INTO v_payment_verified;
  IF NOT v_payment_verified THEN
    RAISE EXCEPTION 'Order % does not have a verified successful payment', p_order_id;
  END IF;

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
    IF item_rec.seller_id IS NULL THEN
      RAISE EXCEPTION 'Store % on order % has no seller assigned', item_rec.store_id, p_order_id;
    END IF;

    v_commission_amount := ROUND(item_rec.line_total * v_commission_rate, 2);
    v_net_earnings := item_rec.line_total - v_commission_amount;

    INSERT INTO seller_earnings (
      seller_id, store_id, order_id, order_item_id,
      gross_amount, commission_rate, commission_amount, net_earnings,
      status
    )
    VALUES (
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
$$;

REVOKE EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.process_order_post_payment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment_verified boolean;
  v_log_exists boolean;
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

  SELECT EXISTS(SELECT 1 FROM order_processing_log WHERE order_id = p_order_id) INTO v_log_exists;

  IF NOT v_log_exists THEN
    INSERT INTO order_processing_log (order_id, stock_decremented, earnings_created)
    VALUES (p_order_id, false, false)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  SELECT stock_decremented, earnings_created
  INTO v_stock_decremented, v_earnings_created
  FROM order_processing_log
  WHERE order_id = p_order_id;

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
$$;

REVOKE EXECUTE ON FUNCTION public.process_order_post_payment(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_post_payment(uuid) TO service_role;