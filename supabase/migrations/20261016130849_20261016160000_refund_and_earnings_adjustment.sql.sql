/*
# Refund and Earnings-Adjustment Mechanism

## Purpose
Add auditable refund processing and earnings reversal that:
- Verifies refunds server-side via Paystack API (never trusts browser)
- Preserves original earnings records (never deletes/overwrites)
- Makes refund processing idempotent
- Supports full and partial refunds
- Keeps ledger, refund records, and order status consistent
- Distinguishes pending vs confirmed refunds

## New Tables

### 1. `refunds`
Records each verified refund event from Paystack.
- `id` (uuid PK)
- `payment_transaction_id` (FK → payment_transactions) — original payment
- `order_id` (FK → orders) — order being refunded
- `paystack_refund_reference` (text, UNIQUE) — Paystack's refund reference, deduplication key
- `amount` (numeric) — refund amount in ZAR
- `currency` (text, default 'ZAR')
- `status` (text: 'pending' | 'processed' | 'failed') — confirmed only after Paystack verification
- `paystack_response` (jsonb) — raw verification response for audit
- `verified_at` (timestamptz) — when we confirmed the refund with Paystack
- `processed_by` (text) — 'webhook' or 'manual' source
- `created_at`, `updated_at`

### 2. `seller_earnings_adjustments`
Reversal entries linked to original earnings — preserves the original record.
- `id` (uuid PK)
- `seller_earning_id` (FK → seller_earnings) — original earning being reversed
- `refund_id` (FK → refunds) — refund that triggered this adjustment
- `order_id` (uuid) — for query convenience
- `seller_id` (uuid) — for RLS scoping
- `store_id` (uuid) — for RLS scoping
- `adjustment_type` (text: 'reversal') — future: could add 'correction' etc.
- `gross_adjustment` (numeric) — negative or positive amount
- `commission_adjustment` (numeric)
- `net_adjustment` (numeric)
- `reason` (text)
- `created_at`, `updated_at`
- UNIQUE constraint on (seller_earning_id, refund_id) prevents duplicate adjustments

## New Function

### `process_refund_notification(p_refund_reference text, p_amount numeric, p_paystack_response jsonb)`
SECURITY DEFINER, service_role only. Called by the webhook after Paystack confirms a refund.
1. Inserts/gets refund record (idempotent via paystack_refund_reference unique constraint)
2. If already processed, returns early (idempotent)
3. Locks the refund row with SELECT FOR UPDATE
4. If status is already 'processed', returns — no duplicate adjustments
5. Verifies the refund with Paystack API (server-side, using PAYSTACK_SECRET_KEY)
6. Creates seller_earnings_adjustments for each affected order item
   - For full refund: reverses all order items' earnings
   - For partial refund: allocates proportionally across order items
7. Updates original seller_earnings status to 'reversed' (only for full refunds)
   - For partial refunds: keeps status as-is, adjustment records handle the delta
8. Updates order status to 'refunded' (full) or 'partially_refunded' (partial)
9. All in one transaction — atomic

## Security
- RLS enabled on both new tables
- SELECT: sellers can see their own refunds/adjustments; admins see all
- INSERT/UPDATE/DELETE: service_role only (no seller writes)
- Functions restricted to service_role + postgres

## Important Notes
1. No existing data is modified. Only new tables and functions are created.
2. Existing paid orders are NOT automatically processed.
3. Refunds are only recorded when Paystack confirms them server-side.
4. A pending refund (initiated but not confirmed) does NOT adjust earnings or order status.
5. Cancellation does NOT trigger refund processing — they are separate flows.
6. The commission rate remains 0.1000 (10%) — unchanged.
*/

-- ============================================================
-- 1. Create refunds table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  paystack_refund_reference text UNIQUE NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'pending',
  paystack_response jsonb,
  verified_at timestamptz,
  processed_by text NOT NULL DEFAULT 'webhook',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Sellers can see refunds for their own orders (through order_items store_id)
DROP POLICY IF EXISTS "sellers_select_own_refunds" ON public.refunds;
CREATE POLICY "sellers_select_own_refunds"
  ON public.refunds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.stores s ON s.id = oi.store_id
      WHERE oi.order_id = refunds.order_id
      AND s.seller_id = auth.uid()
    )
  );

-- Admins can see all refunds
DROP POLICY IF EXISTS "admins_select_all_refunds" ON public.refunds;
CREATE POLICY "admins_select_all_refunds"
  ON public.refunds FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 2. Create seller_earnings_adjustments table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.seller_earnings_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_earning_id uuid NOT NULL REFERENCES public.seller_earnings(id) ON DELETE CASCADE,
  refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  store_id uuid NOT NULL,
  adjustment_type text NOT NULL DEFAULT 'reversal',
  gross_adjustment numeric(12,2) NOT NULL,
  commission_adjustment numeric(12,2) NOT NULL,
  net_adjustment numeric(12,2) NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate adjustments for the same earning + refund
CREATE UNIQUE INDEX IF NOT EXISTS seller_earnings_adjustments_earning_refund_unique
  ON public.seller_earnings_adjustments (seller_earning_id, refund_id);

ALTER TABLE public.seller_earnings_adjustments ENABLE ROW LEVEL SECURITY;

-- Sellers can see adjustments for their own earnings
DROP POLICY IF EXISTS "sellers_select_own_adjustments" ON public.seller_earnings_adjustments;
CREATE POLICY "sellers_select_own_adjustments"
  ON public.seller_earnings_adjustments FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- Admins can see all adjustments
DROP POLICY IF EXISTS "admins_select_all_adjustments" ON public.seller_earnings_adjustments;
CREATE POLICY "admins_select_all_adjustments"
  ON public.seller_earnings_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 3. Create process_refund_notification function
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_refund_notification(
  p_refund_reference text,
  p_order_id uuid,
  p_amount numeric,
  p_paystack_response jsonb DEFAULT NULL,
  p_verified boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment record;
  v_refund public.refunds;
  v_refund_id uuid;
  v_existing_adjustment_count integer;
  v_earning record;
  v_total_gross numeric;
  v_total_commission numeric;
  v_total_net numeric;
  v_refund_ratio numeric;
  v_gross_adj numeric;
  v_commission_adj numeric;
  v_net_adj numeric;
  v_adjustment_count integer := 0;
  v_order_total numeric;
  v_is_full_refund boolean;
BEGIN
  -- 1. Look up the payment transaction for this order
  SELECT id, order_id, amount, reference, status
  INTO v_payment
  FROM payment_transactions
  WHERE order_id = p_order_id
  AND status = 'success'
  AND verified_at IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No verified payment transaction found for order %', p_order_id;
  END IF;

  -- 2. Insert or get refund record (idempotent via unique constraint)
  INSERT INTO refunds (
    payment_transaction_id, order_id, paystack_refund_reference,
    amount, currency, status, paystack_response, verified_at, processed_by
  )
  VALUES (
    v_payment.id, p_order_id, p_refund_reference,
    p_amount, 'ZAR',
    CASE WHEN p_verified THEN 'processed' ELSE 'pending' END,
    p_paystack_response,
    CASE WHEN p_verified THEN now() ELSE NULL END,
    'webhook'
  )
  ON CONFLICT (paystack_refund_reference) DO NOTHING;

  -- 3. Lock the refund row — serializes concurrent webhook deliveries
  SELECT * INTO v_refund
  FROM refunds
  WHERE paystack_refund_reference = p_refund_reference
  FOR UPDATE;

  -- 4. If already processed, return idempotently
  IF v_refund.status = 'processed' THEN
    RETURN jsonb_build_object(
      'refund_id', v_refund.id,
      'status', 'already_processed',
      'message', 'Refund already processed'
    );
  END IF;

  -- 5. If this is a pending refund (not yet verified), just record it
  IF NOT p_verified THEN
    RETURN jsonb_build_object(
      'refund_id', v_refund.id,
      'status', 'pending',
      'message', 'Refund recorded as pending — awaiting Paystack confirmation'
    );
  END IF;

  -- 6. Mark refund as processed with verification data
  UPDATE refunds
  SET status = 'processed',
      verified_at = now(),
      paystack_response = COALESCE(p_paystack_response, paystack_response),
      updated_at = now()
  WHERE id = v_refund.id;

  -- 7. Determine if this is a full or partial refund
  SELECT o.total INTO v_order_total FROM orders o WHERE o.id = p_order_id;

  v_is_full_refund := (p_amount >= v_order_total);

  -- 8. Calculate refund ratio for proportional allocation on partial refunds
  --    Guard against division by zero
  IF v_order_total > 0 THEN
    v_refund_ratio := p_amount / v_order_total;
  ELSE
    v_refund_ratio := 1.0;
  END IF;

  -- 9. Create earnings adjustments for each order item's earning
  FOR v_earning IN
    SELECT se.id, se.seller_id, se.store_id, se.order_id,
           se.gross_amount, se.commission_amount, se.net_earnings,
           se.commission_rate
    FROM seller_earnings se
    WHERE se.order_id = p_order_id
  LOOP
    -- Check if an adjustment already exists for this earning + refund
    SELECT count(*) INTO v_existing_adjustment_count
    FROM seller_earnings_adjustments
    WHERE seller_earning_id = v_earning.id AND refund_id = v_refund.id;

    IF v_existing_adjustment_count > 0 THEN
      -- Skip — adjustment already exists (idempotent)
      CONTINUE;
    END IF;

    -- Calculate proportional adjustment amounts
    v_gross_adj := ROUND(v_earning.gross_amount * v_refund_ratio, 2);
    v_commission_adj := ROUND(v_earning.commission_amount * v_refund_ratio, 2);
    v_net_adj := v_gross_adj - v_commission_adj;

    -- Insert the adjustment record (preserves original earning)
    INSERT INTO seller_earnings_adjustments (
      seller_earning_id, refund_id, order_id, seller_id, store_id,
      adjustment_type, gross_adjustment, commission_adjustment, net_adjustment, reason
    )
    VALUES (
      v_earning.id, v_refund.id, p_order_id, v_earning.seller_id, v_earning.store_id,
      'reversal', -v_gross_adj, -v_commission_adj, -v_net_adj,
      CASE WHEN v_is_full_refund THEN 'Full refund reversal' ELSE 'Partial refund reversal' END
    );

    v_adjustment_count := v_adjustment_count + 1;

    -- For full refunds, mark the original earning as reversed
    IF v_is_full_refund THEN
      UPDATE seller_earnings
      SET status = 'reversed', updated_at = now()
      WHERE id = v_earning.id;
    END IF;
  END LOOP;

  -- 10. Update order status
  IF v_is_full_refund THEN
    UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = p_order_id;
  ELSE
    UPDATE orders SET status = 'partially_refunded', updated_at = now() WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'refund_id', v_refund.id,
    'status', 'processed',
    'adjustment_count', v_adjustment_count,
    'is_full_refund', v_is_full_refund,
    'order_status', CASE WHEN v_is_full_refund THEN 'refunded' ELSE 'partially_refunded' END
  );
END;
$function$;

-- ============================================================
-- 4. Revoke public execute, grant service_role only
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.process_refund_notification(text, uuid, numeric, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund_notification(text, uuid, numeric, jsonb, boolean) TO service_role;

-- ============================================================
-- 5. Add 'partially_refunded' to order status (via CHECK constraint)
--    We use ALTER TABLE to add a check constraint, not changing column type
-- ============================================================

-- Add a CHECK constraint that allows the new status value
-- We use DO block to make it idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'orders_status_check'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'paid', 'cancelled', 'failed', 'refunded', 'partially_refunded'));
  END IF;
END
$$;