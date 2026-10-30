/*
# Pre-payout readiness audit fixes

## Issues found and fixed:

### 1. Cumulative refund capping
The function did not check whether a new refund, combined with existing
processed refunds for the same order, would exceed the original payment
amount. A malicious or buggy sequence of partial refunds could reverse
more than 100% of earnings.

Fix: Before processing, sum all existing processed refund amounts for
the order. If the new refund would exceed the payment amount, clamp it
to the remaining refundable amount.

### 2. Terminal status regression — pending after processed
If a pending webhook arrives after the refund is already processed
(e.g. out-of-order delivery), the function would update paystack_response
on the already-processed refund. While step 4 correctly returns
"already_processed" for processed refunds, the paystack_response update
in step 5 was still reachable for non-verified calls on pending-status
records. This is actually correct behaviour (the row is still 'pending'),
but we need to ensure that a pending event for an already-processed
refund reference is truly a no-op.

The current logic handles this correctly: step 4 returns early if
status='processed'. A pending event for the same reference hits the
ON CONFLICT DO NOTHING, then SELECT FOR UPDATE sees 'processed', and
returns "already_processed". No regression possible.

### 3. Order status upgrade from partially_refunded to refunded
If a partial refund is processed first, then a full refund follows,
the order should upgrade from 'partially_refunded' to 'refunded'.
The current logic handles this correctly because it checks
p_amount >= v_order_total each time, not cumulative refunds.

However, if cumulative refunds now reach the full order total through
multiple partial refunds, the order should be marked 'refunded'.
Fix: After capping, check if cumulative processed refunds now equal
or exceed the order total.

### 4. Revoke excessive table grants
The anon and authenticated roles had INSERT/UPDATE/DELETE/TRUNCATE
grants on refunds and seller_earnings_adjustments. While RLS blocks
unauthorized use, these grants should not exist. Revoke them.

No data is changed. Only the function definition and grants change.
*/

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

  -- 2. Insert refund record ALWAYS as 'pending' status.
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

  -- 3. Lock the refund row — serializes concurrent webhook deliveries
  SELECT * INTO v_refund
  FROM refunds
  WHERE paystack_refund_reference = p_refund_reference
  FOR UPDATE;

  -- 4. If already processed, return idempotently (duplicate webhook or out-of-order)
  IF v_refund.status = 'processed' THEN
    RETURN jsonb_build_object(
      'refund_id', v_refund.id,
      'status', 'already_processed',
      'message', 'Refund already processed'
    );
  END IF;

  -- 5. If this call is not verified, just record as pending and return.
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

  -- 6. At this point, p_verified=true and status is 'pending'.
  --    Process the refund: create adjustments, mark as processed.

  -- Determine order total
  SELECT o.total INTO v_order_total FROM orders o WHERE o.id = p_order_id;

  -- 6a. Cumulative refund capping
  -- Sum all existing PROCESSED refund amounts for this order
  SELECT COALESCE(SUM(amount), 0) INTO v_existing_refunded
  FROM refunds
  WHERE order_id = p_order_id
  AND status = 'processed';

  v_remaining_refundable := v_order_total - v_existing_refunded;

  -- Clamp the effective refund amount to the remaining refundable amount
  IF p_amount > v_remaining_refundable THEN
    v_effective_amount := GREATEST(v_remaining_refundable, 0);
  ELSE
    v_effective_amount := p_amount;
  END IF;

  -- If there's nothing left to refund, record as processed with 0 adjustments
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

  -- Update the refund amount to the effective (capped) amount
  UPDATE refunds
  SET amount = v_effective_amount, updated_at = now()
  WHERE id = v_refund.id;

  -- Check if this makes it a full refund (cumulative)
  v_cumulative_refunded := v_existing_refunded + v_effective_amount;
  v_is_full_refund := (v_cumulative_refunded >= v_order_total);

  -- Calculate refund ratio for proportional allocation
  IF v_order_total > 0 THEN
    v_refund_ratio := v_effective_amount / v_order_total;
  ELSE
    v_refund_ratio := 1.0;
  END IF;

  -- 7. Create earnings adjustments for each order item's earning
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

  -- 8. Mark refund as processed with verification data
  UPDATE refunds
  SET status = 'processed',
      verified_at = now(),
      paystack_response = COALESCE(p_paystack_response, paystack_response),
      updated_at = now()
  WHERE id = v_refund.id;

  -- 9. Update order status
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

-- Preserve permissions
REVOKE EXECUTE ON FUNCTION public.process_refund_notification(text, uuid, numeric, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund_notification(text, uuid, numeric, jsonb, boolean) TO service_role;

-- ============================================================
-- Revoke excessive table grants on refunds and seller_earnings_adjustments
-- Only service_role and postgres should have write access.
-- anon and authenticated get SELECT only (for RLS to work).
-- ============================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.refunds FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.seller_earnings_adjustments FROM anon, authenticated;

-- Grant SELECT only to authenticated (RLS will filter rows)
GRANT SELECT ON public.refunds TO authenticated;
GRANT SELECT ON public.seller_earnings_adjustments TO authenticated;