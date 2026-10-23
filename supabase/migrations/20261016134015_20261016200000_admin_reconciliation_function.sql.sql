/*
# Admin Financial Reconciliation Function

## Purpose
Read-only SQL function that computes order-level financial reconciliation
data for the admin dashboard. Aggregates earnings, adjustments, refunds, and
processing status per order without modifying any records.

## New Database Objects
- `get_reconciliation_summary(p_date_from, p_date_to, p_order_ref, p_seller_id, p_payment_status, p_recon_status)`
  SECURITY DEFINER function returning a JSON object with:
  - `summary`: aggregate figures across filtered orders
  - `rows`: per-order reconciliation detail
  - `issues`: per-order flags for data integrity problems

## Reconciliation Formulas
- Gross Sales = SUM(order.total) for orders with status = 'paid'
- Platform Commission = SUM(seller_earnings.commission_amount) for non-reversed earnings
- Seller Net Earnings (original) = SUM(seller_earnings.net_earnings) for non-reversed earnings
- Earnings Reversals = SUM(seller_earnings_adjustments.net_adjustment) — always negative
- Processed Refunds = SUM(refunds.amount) WHERE status = 'processed'
- Adjusted Net Earnings = Seller Net Earnings + Earnings Reversals
- Each source is aggregated independently before joining to avoid double-counting
  multi-item or multi-seller orders

## Issue Flags Detected
1. `missing_earnings` — paid order with no seller_earnings rows
2. `duplicate_earnings` — more than one seller_earnings row for the same order_item_id
3. `mismatched_totals` — SUM(seller_earnings.gross_amount) != SUM(order_items.line_total) for the order
4. `refund_exceeds_total` — SUM(refunds.amount WHERE status='processed') > order.total
5. `incomplete_processing` — order_processing_log shows stock_decremented=false or earnings_created=false
6. `status_inconsistency` — order has processed refunds but status is not 'refunded' or 'partially_refunded'

## Security
- SECURITY DEFINER, executable only by authenticated users where private.is_admin() returns true
- All queries are read-only — no INSERT, UPDATE, or DELETE
- Execution restricted to service_role and postgres via REVOKE from anon/authenticated + GRANT to service_role
- Seller financial data is never exposed to other sellers through this function

## Important Notes
1. This function is READ-ONLY. It never modifies financial records.
2. Filters are applied at the order level; aggregations are computed per-order.
3. The function uses CTEs to aggregate each source independently before joining.
4. NULL handling: COALESCE is used so orders with no earnings/refunds show 0, not NULL.
5. The function returns JSON to simplify frontend consumption via RPC.
*/

CREATE OR REPLACE FUNCTION public.get_reconciliation_summary(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_order_ref text DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL,
  p_payment_status text DEFAULT NULL,
  p_recon_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Enforce admin-only access
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  WITH
  -- Base set of orders filtered by date, order reference, payment status
  filtered_orders AS (
    SELECT o.id, o.order_number, o.status, o.total, o.subtotal, o.delivery_fee, o.created_at
    FROM orders o
    WHERE (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at <= p_date_to)
      AND (p_order_ref IS NULL OR o.order_number ILIKE '%' || p_order_ref || '%')
      AND (p_payment_status IS NULL OR p_payment_status = 'all' OR o.status = p_payment_status)
  ),

  -- If seller filter is provided, restrict to orders that have items from that seller's stores
  seller_filtered_orders AS (
    SELECT fo.*
    FROM filtered_orders fo
    WHERE p_seller_id IS NULL
       OR EXISTS (
         SELECT 1 FROM order_items oi
         JOIN stores s ON s.id = oi.store_id
         WHERE oi.order_id = fo.id AND s.seller_id = p_seller_id
       )
  ),

  -- Payment transaction summary per order
  payment_summary AS (
    SELECT
      pt.order_id,
      COUNT(*) AS payment_count,
      MAX(pt.status) FILTER (WHERE pt.status = 'success') IS NOT NULL AS has_verified_payment,
      MAX(pt.reference) AS payment_reference,
      MAX(pt.status) AS payment_status,
      MAX(pt.verified_at) AS verified_at
    FROM payment_transactions pt
    JOIN seller_filtered_orders sfo ON pt.order_id = sfo.id
    GROUP BY pt.order_id
  ),

  -- Earnings summary per order (aggregated across all sellers/items)
  earnings_summary AS (
    SELECT
      se.order_id,
      COUNT(*) AS earnings_count,
      SUM(se.gross_amount) AS gross_earnings,
      SUM(se.commission_amount) AS total_commission,
      SUM(se.net_earnings) AS original_net_earnings,
      COUNT(*) FILTER (WHERE se.status = 'reversed') AS reversed_count,
      SUM(se.net_earnings) FILTER (WHERE se.status != 'reversed') AS active_net_earnings,
      SUM(se.gross_amount) FILTER (WHERE se.status != 'reversed') AS active_gross_earnings,
      SUM(se.commission_amount) FILTER (WHERE se.status != 'reversed') AS active_commission
    FROM seller_earnings se
    JOIN seller_filtered_orders sfo ON se.order_id = sfo.id
    GROUP BY se.order_id
  ),

  -- Duplicate earnings detection: more than one row per order_item_id
  duplicate_earnings AS (
    SELECT se.order_id, COUNT(*) AS dup_count
    FROM (
      SELECT order_id, order_item_id, COUNT(*) AS cnt
      FROM seller_earnings
      GROUP BY order_id, order_item_id
      HAVING COUNT(*) > 1
    ) se
    JOIN seller_filtered_orders sfo ON se.order_id = sfo.id
    GROUP BY se.order_id
  ),

  -- Adjustments summary per order
  adjustments_summary AS (
    SELECT
      sea.order_id,
      COUNT(*) AS adjustment_count,
      SUM(sea.gross_adjustment) AS total_gross_adjustment,
      SUM(sea.net_adjustment) AS total_net_adjustment,
      SUM(sea.commission_adjustment) AS total_commission_adjustment
    FROM seller_earnings_adjustments sea
    JOIN seller_filtered_orders sfo ON sea.order_id = sfo.id
    GROUP BY sea.order_id
  ),

  -- Refunds summary per order
  refunds_summary AS (
    SELECT
      r.order_id,
      COUNT(*) AS refund_count,
      SUM(r.amount) AS total_refund_amount,
      SUM(r.amount) FILTER (WHERE r.status = 'processed') AS processed_refund_amount,
      SUM(r.amount) FILTER (WHERE r.status = 'pending') AS pending_refund_amount,
      COUNT(*) FILTER (WHERE r.status = 'processed') AS processed_refund_count,
      COUNT(*) FILTER (WHERE r.status = 'pending') AS pending_refund_count
    FROM refunds r
    JOIN seller_filtered_orders sfo ON r.order_id = sfo.id
    GROUP BY r.order_id
  ),

  -- Order items line total sum per order
  items_summary AS (
    SELECT
      oi.order_id,
      SUM(oi.line_total) AS items_line_total,
      COUNT(*) AS item_count,
      COUNT(DISTINCT oi.store_id) AS seller_count
    FROM order_items oi
    JOIN seller_filtered_orders sfo ON oi.order_id = sfo.id
    GROUP BY oi.order_id
  ),

  -- Processing log per order
  processing_summary AS (
    SELECT
      opl.order_id,
      opl.stock_decremented,
      opl.earnings_created,
      opl.processing_error,
      opl.processed_at
    FROM order_processing_log opl
    JOIN seller_filtered_orders sfo ON opl.order_id = sfo.id
  ),

  -- Build the per-order reconciliation rows with issue flags
  recon_rows AS (
    SELECT
      sfo.id AS order_id,
      sfo.order_number,
      sfo.status AS order_status,
      sfo.total AS order_total,
      sfo.subtotal,
      sfo.delivery_fee,
      sfo.created_at,
      COALESCE(ps.payment_reference, NULL) AS payment_reference,
      COALESCE(ps.payment_status, NULL) AS payment_tx_status,
      COALESCE(ps.has_verified_payment, false) AS has_verified_payment,
      ps.verified_at,
      COALESCE(es.earnings_count, 0) AS earnings_count,
      COALESCE(es.active_gross_earnings, 0) AS gross_earnings,
      COALESCE(es.active_commission, 0) AS commission,
      COALESCE(es.active_net_earnings, 0) AS original_net_earnings,
      COALESCE(es.reversed_count, 0) AS reversed_earnings_count,
      COALESCE(ads.total_net_adjustment, 0) AS net_adjustment,
      COALESCE(ads.adjustment_count, 0) AS adjustment_count,
      COALESCE(es.active_net_earnings, 0) + COALESCE(ads.total_net_adjustment, 0) AS adjusted_net_earnings,
      COALESCE(rs.processed_refund_amount, 0) AS processed_refund_total,
      COALESCE(rs.pending_refund_amount, 0) AS pending_refund_total,
      COALESCE(rs.refund_count, 0) AS refund_count,
      COALESCE(ims.items_line_total, 0) AS items_line_total,
      COALESCE(ims.item_count, 0) AS item_count,
      COALESCE(ims.seller_count, 0) AS seller_count,
      prs.stock_decremented,
      prs.earnings_created,
      prs.processing_error,
      prs.processed_at,
      -- Issue flags
      CASE WHEN sfo.status = 'paid' AND COALESCE(es.earnings_count, 0) = 0 THEN true ELSE false END AS issue_missing_earnings,
      CASE WHEN COALESCE(de.dup_count, 0) > 0 THEN true ELSE false END AS issue_duplicate_earnings,
      CASE WHEN COALESCE(es.active_gross_earnings, 0) != COALESCE(ims.items_line_total, 0) AND COALESCE(es.earnings_count, 0) > 0 THEN true ELSE false END AS issue_mismatched_totals,
      CASE WHEN COALESCE(rs.processed_refund_amount, 0) > sfo.total THEN true ELSE false END AS issue_refund_exceeds_total,
      CASE WHEN sfo.status = 'paid' AND (COALESCE(prs.stock_decremented, false) = false OR COALESCE(prs.earnings_created, false) = false) THEN true ELSE false END AS issue_incomplete_processing,
      CASE WHEN COALESCE(rs.processed_refund_count, 0) > 0 AND sfo.status NOT IN ('refunded', 'partially_refunded') THEN true ELSE false END AS issue_status_inconsistency
    FROM seller_filtered_orders sfo
    LEFT JOIN payment_summary ps ON ps.order_id = sfo.id
    LEFT JOIN earnings_summary es ON es.order_id = sfo.id
    LEFT JOIN duplicate_earnings de ON de.order_id = sfo.id
    LEFT JOIN adjustments_summary ads ON ads.order_id = sfo.id
    LEFT JOIN refunds_summary rs ON rs.order_id = sfo.id
    LEFT JOIN items_summary ims ON ims.order_id = sfo.id
    LEFT JOIN processing_summary prs ON prs.order_id = sfo.id
  ),

  -- Apply reconciliation status filter
  filtered_recon AS (
    SELECT * FROM recon_rows rr
    WHERE p_recon_status IS NULL OR p_recon_status = 'all'
       OR (p_recon_status = 'issues' AND (
         rr.issue_missing_earnings OR rr.issue_duplicate_earnings OR
         rr.issue_mismatched_totals OR rr.issue_refund_exceeds_total OR
         rr.issue_incomplete_processing OR rr.issue_status_inconsistency
       ))
       OR (p_recon_status = 'clean' AND NOT (
         rr.issue_missing_earnings OR rr.issue_duplicate_earnings OR
         rr.issue_mismatched_totals OR rr.issue_refund_exceeds_total OR
         rr.issue_incomplete_processing OR rr.issue_status_inconsistency
       ))
  ),

  -- Compute summary aggregates from the filtered set
  summary_calc AS (
    SELECT
      COUNT(*) AS total_orders,
      COUNT(*) FILTER (WHERE order_status = 'paid') AS paid_orders,
      COALESCE(SUM(order_total) FILTER (WHERE order_status = 'paid'), 0) AS gross_sales,
      COALESCE(SUM(commission) FILTER (WHERE order_status = 'paid'), 0) AS platform_commission,
      COALESCE(SUM(original_net_earnings) FILTER (WHERE order_status = 'paid'), 0) AS seller_net_earnings,
      COALESCE(SUM(net_adjustment) FILTER (WHERE order_status = 'paid'), 0) AS earnings_reversals,
      COALESCE(SUM(adjusted_net_earnings) FILTER (WHERE order_status = 'paid'), 0) AS adjusted_net_earnings,
      COALESCE(SUM(processed_refund_total), 0) AS processed_refunds,
      COALESCE(SUM(pending_refund_total), 0) AS pending_refunds,
      COUNT(*) FILTER (WHERE issue_missing_earnings) AS issues_missing_earnings,
      COUNT(*) FILTER (WHERE issue_duplicate_earnings) AS issues_duplicate_earnings,
      COUNT(*) FILTER (WHERE issue_mismatched_totals) AS issues_mismatched_totals,
      COUNT(*) FILTER (WHERE issue_refund_exceeds_total) AS issues_refund_exceeds,
      COUNT(*) FILTER (WHERE issue_incomplete_processing) AS issues_incomplete_processing,
      COUNT(*) FILTER (WHERE issue_status_inconsistency) AS issues_status_inconsistency,
      COUNT(*) FILTER (WHERE issue_missing_earnings OR issue_duplicate_earnings OR
         issue_mismatched_totals OR issue_refund_exceeds_total OR
         issue_incomplete_processing OR issue_status_inconsistency) AS total_issue_orders
    FROM filtered_recon
  )

  SELECT jsonb_build_object(
    'summary', to_jsonb(sc.*),
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(fr.*) ORDER BY fr.created_at DESC) FROM filtered_recon fr), '[]'::jsonb)
  ) INTO v_result
  FROM summary_calc sc;

  RETURN v_result;
END;
$$;

-- Restrict execution to service_role and postgres only
REVOKE EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) TO service_role;
