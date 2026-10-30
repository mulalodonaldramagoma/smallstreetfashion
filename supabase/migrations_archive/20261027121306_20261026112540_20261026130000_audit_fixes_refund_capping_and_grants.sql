-- Pre-payout readiness audit fixes
-- Adds cumulative refund capping, revokes excessive table grants.
-- Replaces process_refund_notification with the hardened version.

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
  v_effective_amount numeric;
  v_existing_refunded numeric;
  v_remaining_refundable numeric;
  v_cumulative_refunded numeric;
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

  SELECT COALESCE(SUM(amount), 0) INTO v_existing_refunded
  FROM refunds
  WHERE order_id = p_order_id
  AND status = 'processed';

  v_remaining_refundable := v_order_total - v_existing_refunded;

  IF p_amount > v_remaining_refundable THEN
    v_effective_amount := GREATEST(v_remaining_refundable, 0);
  ELSE
    v_effective_amount := p_amount;
  END IF;

  IF v_effective_amount <= 0 THEN
    UPDATE refunds
    SET status = 'processed',
        verified_at = now(),
        paystack_response = COALESCE(p_paystack_response, paystack_response),
        updated_at = now()
    WHERE id = v_refund.id;

    RETURN jsonb_build_object(
      'refund_id', v_refund.id,
      'status', 'processed',
      'adjustment_count', 0,
      'message', 'Cumulative refunds already equal or exceed order total — no adjustment created'
    );
  END IF;

  UPDATE refunds
  SET amount = v_effective_amount, updated_at = now()
  WHERE id = v_refund.id;

  v_cumulative_refunded := v_existing_refunded + v_effective_amount;
  v_is_full_refund := (v_cumulative_refunded >= v_order_total);

  IF v_order_total > 0 THEN
    v_refund_ratio := v_effective_amount / v_order_total;
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
    'effective_amount', v_effective_amount,
    'cumulative_refunded', v_cumulative_refunded,
    'order_status', CASE WHEN v_is_full_refund THEN 'refunded' ELSE 'partially_refunded' END
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.process_refund_notification(text, uuid, numeric, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund_notification(text, uuid, numeric, jsonb, boolean) TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.refunds FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.seller_earnings_adjustments FROM anon, authenticated;

GRANT SELECT ON public.refunds TO authenticated;
GRANT SELECT ON public.seller_earnings_adjustments TO authenticated;