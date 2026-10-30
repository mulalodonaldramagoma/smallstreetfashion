-- Refund and Earnings-Adjustment Mechanism (migration 4 of batch 3)
-- Creates refunds table, seller_earnings_adjustments table, and
-- process_refund_notification function. Idempotent refund records
-- preserve original earnings. SECURITY DEFINER, service_role only.

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

DROP POLICY IF EXISTS "admins_select_all_refunds" ON public.refunds;
CREATE POLICY "admins_select_all_refunds"
  ON public.refunds FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

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

CREATE UNIQUE INDEX IF NOT EXISTS seller_earnings_adjustments_earning_refund_unique
  ON public.seller_earnings_adjustments (seller_earning_id, refund_id);

ALTER TABLE public.seller_earnings_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sellers_select_own_adjustments" ON public.seller_earnings_adjustments;
CREATE POLICY "sellers_select_own_adjustments"
  ON public.seller_earnings_adjustments FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "admins_select_all_adjustments" ON public.seller_earnings_adjustments;
CREATE POLICY "admins_select_all_adjustments"
  ON public.seller_earnings_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

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
  v_existing_adjustment_count integer;
  v_earning record;
  v_refund_ratio numeric;
  v_gross_adj numeric;
  v_commission_adj numeric;
  v_net_adj numeric;
  v_adjustment_count integer := 0;
  v_order_total numeric;
  v_is_full_refund boolean;
  v_was_pending boolean;
BEGIN
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

  INSERT INTO refunds (
    payment_transaction_id, order_id, paystack_refund_reference,
    amount, currency, status, paystack_response, verified_at, processed_by
  )
  VALUES (
    v_payment.id, p_order_id, p_refund_reference,
    p_amount, 'ZAR',
    'pending',
    p_paystack_response,
    NULL,
    'webhook'
  )
  ON CONFLICT (paystack_refund_reference) DO NOTHING;

  SELECT * INTO v_refund
  FROM refunds
  WHERE paystack_refund_reference = p_refund_reference
  FOR UPDATE;

  IF v_refund.status = 'processed' THEN
    RETURN jsonb_build_object(
      'refund_id', v_refund.id,
      'status', 'already_processed',
      'message', 'Refund already processed'
    );
  END IF;

  IF NOT p_verified THEN
    IF p_paystack_response IS NOT NULL THEN
      UPDATE refunds
      SET paystack_response = p_paystack_response, updated_at = now()
      WHERE id = v_refund.id;
    END IF;

    RETURN jsonb_build_object(
      'refund_id', v_refund.id,
      'status', 'pending',
      'message', 'Refund recorded as pending — awaiting Paystack confirmation'
    );
  END IF;

  SELECT o.total INTO v_order_total FROM orders o WHERE o.id = p_order_id;
  v_is_full_refund := (p_amount >= v_order_total);

  IF v_order_total > 0 THEN
    v_refund_ratio := p_amount / v_order_total;
  ELSE
    v_refund_ratio := 1.0;
  END IF;

  FOR v_earning IN
    SELECT se.id, se.seller_id, se.store_id, se.order_id,
           se.gross_amount, se.commission_amount, se.net_earnings,
           se.commission_rate
    FROM seller_earnings se
    WHERE se.order_id = p_order_id
  LOOP
    SELECT count(*) INTO v_existing_adjustment_count
    FROM seller_earnings_adjustments
    WHERE seller_earning_id = v_earning.id AND refund_id = v_refund.id;

    IF v_existing_adjustment_count > 0 THEN
      CONTINUE;
    END IF;

    v_gross_adj := ROUND(v_earning.gross_amount * v_refund_ratio, 2);
    v_commission_adj := ROUND(v_earning.commission_amount * v_refund_ratio, 2);
    v_net_adj := v_gross_adj - v_commission_adj;

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

    IF v_is_full_refund THEN
      UPDATE seller_earnings
      SET status = 'reversed', updated_at = now()
      WHERE id = v_earning.id;
    END IF;
  END LOOP;

  UPDATE refunds
  SET status = 'processed',
      verified_at = now(),
      paystack_response = COALESCE(p_paystack_response, paystack_response),
      updated_at = now()
  WHERE id = v_refund.id;

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

REVOKE EXECUTE ON FUNCTION public.process_refund_notification(text, uuid, numeric, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund_notification(text, uuid, numeric, jsonb, boolean) TO service_role;

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
