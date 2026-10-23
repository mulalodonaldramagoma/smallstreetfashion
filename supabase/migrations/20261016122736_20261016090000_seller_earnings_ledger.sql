/*
# Seller Earnings Ledger — Phase 1

## Purpose
Creates the seller earnings ledger that records per-order-item commission and
net earnings for each seller after a verified successful payment. This phase
does NOT implement payouts, transfers, or seller balance aggregation — it only
creates the immutable ledger records and the server-side function that populates
them.

## 1. New Tables

### seller_earnings
- `id` (uuid, PK) — unique earnings record ID
- `seller_id` (uuid, NOT NULL) — the profile ID of the seller who owns the store
- `store_id` (uuid, NOT NULL) — the store the order item belongs to
- `order_id` (uuid, NOT NULL) — the parent order
- `order_item_id` (uuid, NOT NULL) — the specific order item this earning is derived from
- `gross_amount` (numeric(12,2), NOT NULL) — the order item's line_total (commission base)
- `commission_rate` (numeric(5,4), NOT NULL) — the rate applied (0.1000 = 10%)
- `commission_amount` (numeric(12,2), NOT NULL) — gross_amount × commission_rate, rounded to 2dp
- `net_earnings` (numeric(12,2), NOT NULL) — gross_amount − commission_amount
- `status` (text, NOT NULL, default 'pending') — pending / available / paid / reversed
- `created_at` (timestamptz, NOT NULL, default now())
- `updated_at` (timestamptz, NOT NULL, default now())

Constraints:
- `seller_earnings_order_item_unique` — UNIQUE(order_item_id) prevents duplicate
  earnings for the same order item, making the function idempotent.
- `seller_earnings_status_check` — CHECK(status IN ('pending','available','paid','reversed'))
- `seller_earnings_amounts_check` — CHECK(gross_amount >= 0 AND commission_amount >= 0 AND net_earnings >= 0)
- `seller_earnings_math_check` — CHECK(net_earnings = gross_amount - commission_amount)

Indexes:
- `idx_seller_earnings_seller` — on seller_id for seller dashboard queries
- `idx_seller_earnings_store` — on store_id for store-level queries
- `idx_seller_earnings_order` — on order_id for order-level reconciliation
- `idx_seller_earnings_status` — on status for payout/balance queries

### order_processing_log
Tracks whether financial processing (stock decrement + earnings creation) has
completed for a verified-paid order. This enables safe retry without double
processing and provides an audit trail for reconciliation.

- `id` (uuid, PK)
- `order_id` (uuid, NOT NULL, UNIQUE) — one row per order
- `stock_decremented` (boolean, NOT NULL, default false)
- `earnings_created` (boolean, NOT NULL, default false)
- `processing_error` (text, nullable) — last error message if processing failed
- `processed_at` (timestamptz, nullable) — set when all processing completed
- `created_at` (timestamptz, NOT NULL, default now())
- `updated_at` (timestamptz, NOT NULL, default now())

## 2. Database Functions

### create_seller_earnings_for_order(p_order_id uuid)
SECURITY DEFINER, restricted to service_role only. Returns a summary JSON with
the count of earnings created and total net earnings.

Logic:
1. Verify the order exists and has a successful payment_transactions row.
2. Check if earnings already exist for this order (idempotent — return existing count).
3. For each order_item, join to stores to get seller_id.
4. Validate each store has a non-null seller_id.
5. Calculate commission per item: gross = line_total, commission = round(gross × 0.10, 2),
   net = gross - commission.
6. Insert earnings records with ON CONFLICT DO NOTHING on order_item_id.

### process_order_post_payment(p_order_id uuid)
SECURITY DEFINER, restricted to service_role. Atomically processes stock decrement
and earnings creation for a verified order using the order_processing_log table
for idempotency. Returns jsonb with the status of each step.

## 3. Security (RLS)

### seller_earnings
- RLS enabled.
- Sellers can SELECT only their own earnings (seller_id = auth.uid()).
- Admins can SELECT all earnings (private.is_admin()).
- No INSERT, UPDATE, or DELETE policies — all writes go through the SECURITY DEFINER
  function (service_role only).

### order_processing_log
- RLS enabled.
- Admins can SELECT (private.is_admin()).
- No INSERT/UPDATE/DELETE from frontend — all writes via service_role edge function.

## 4. Permissions
- EXECUTE on both functions granted to service_role only.
- EXECUTE revoked from anon and authenticated.

## 5. Important Notes
- Commission rate is stored per-record so historical earnings are never altered
  by future rate changes.
- Delivery fees are NOT included in the commission base.
- Payment-processing fees are NOT deducted from sellers in this phase.
- Earnings status starts as 'pending' — no status changes happen in this phase.
- The unique constraint on order_item_id makes the function safe under concurrent calls.
*/


-- ---------------------------------------------------------------------------
-- 1. seller_earnings table
-- ---------------------------------------------------------------------------
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

-- No INSERT/UPDATE/DELETE policies — all writes via SECURITY DEFINER functions (service_role)

-- ---------------------------------------------------------------------------
-- 2. order_processing_log table
-- ---------------------------------------------------------------------------
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

-- No INSERT/UPDATE/DELETE policies — all writes via service_role edge function

-- ---------------------------------------------------------------------------
-- 3. create_seller_earnings_for_order function
-- ---------------------------------------------------------------------------
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

-- Restrict execution to service_role only (matches decrement_stock pattern)
REVOKE EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. process_order_post_payment function
-- Atomically processes stock decrement and earnings creation for a verified order.
-- Returns jsonb with status of each step. Uses order_processing_log for idempotency.
-- ---------------------------------------------------------------------------
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

  -- 2. Get or create processing log
  SELECT EXISTS(SELECT 1 FROM order_processing_log WHERE order_id = p_order_id) INTO v_log_exists;

  IF NOT v_log_exists THEN
    INSERT INTO order_processing_log (order_id, stock_decremented, earnings_created)
    VALUES (p_order_id, false, false)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  -- Read current state
  SELECT stock_decremented, earnings_created
  INTO v_stock_decremented, v_earnings_created
  FROM order_processing_log
  WHERE order_id = p_order_id;

  -- 3. Stock decrement (if not already done)
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

  -- 4. Earnings creation (if not already done)
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

  -- 5. Finalize if both steps completed
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
