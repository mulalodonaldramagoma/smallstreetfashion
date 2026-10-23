-- ============================================================
-- Admin Financial Reconciliation Tests
-- ============================================================
-- Uses isolated test data with eee... UUIDs.
-- Does NOT modify real financial records.
-- Tests: basic reconciliation, multi-item orders, partial/full
-- refunds, missing earnings, duplicate earnings, mismatched
-- totals, incomplete processing, and status inconsistency.
-- ============================================================

-- Test data constants:
-- Seller 1: fe793e60-39f2-41b5-9786-6caea8852f8f (Meli's Collection)
-- Store 1:  a1111111-1111-4111-8111-111111111111
-- Product 1: 966ccd62-1158-4119-ba7e-a9d04dc1b185 (price 100)
-- Store 2:  a3333333-3333-4333-8333-333333333333 (Solyana)
-- Product 2: f678ed2b-caae-4436-9c19-9c5ec99d74bc (price 379)

-- ============================================================
-- TEST 1: Clean paid order — no issues
-- ============================================================
INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, suburb, city, province, postal_code, subtotal, delivery_fee, total, status)
VALUES ('eee00001-0000-0000-0000-000000000001', 'TEST-RECON-001', 'Recon Test 1', 'recon1@test.local', '0123', 'Addr', 'Suburb', 'City', 'Province', '0001', 100.00, 30.00, 130.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, store_id, product_name, size, colour, quantity, unit_price, line_total)
VALUES ('eee00001-0000-0000-0000-000000000011', 'eee00001-0000-0000-0000-000000000001', '966ccd62-1158-4119-ba7e-a9d04dc1b185', 'a1111111-1111-4111-8111-111111111111', 'Test Product 1', 'M', 'Black', 1, 100.00, 100.00)
ON CONFLICT DO NOTHING;

INSERT INTO payment_transactions (id, order_id, reference, provider, amount, currency, status, verified_at)
VALUES ('eee00001-0000-0000-0000-000000000021', 'eee00001-0000-0000-0000-000000000001', 'test-recon-pay-001', 'paystack', 130.00, 'ZAR', 'success', now())
ON CONFLICT DO NOTHING;

SELECT process_order_post_payment('eee00001-0000-0000-0000-000000000001');

-- Verify: earnings exist, no issues
SELECT
  o.order_number,
  o.status as order_status,
  o.total,
  (SELECT COUNT(*) FROM seller_earnings WHERE order_id = o.id) as earnings_count,
  (SELECT SUM(gross_amount) FROM seller_earnings WHERE order_id = o.id AND status != 'reversed') as gross_earnings,
  (SELECT SUM(net_earnings) FROM seller_earnings WHERE order_id = o.id AND status != 'reversed') as net_earnings,
  (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) as items_total,
  (SELECT COUNT(*) FROM refunds WHERE order_id = o.id AND status = 'processed') as processed_refunds,
  CASE
    WHEN o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM seller_earnings WHERE order_id = o.id) THEN 'MISSING_EARNINGS'
    WHEN (SELECT SUM(gross_amount) FROM seller_earnings WHERE order_id = o.id AND status != 'reversed') != (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id)
      AND EXISTS (SELECT 1 FROM seller_earnings WHERE order_id = o.id) THEN 'MISMATCHED_TOTALS'
    ELSE 'CLEAN'
  END as recon_status
FROM orders o
WHERE o.id = 'eee00001-0000-0000-0000-000000000001';

-- ============================================================
-- TEST 2: Multi-item, multi-store order (same seller, 2 stores)
-- ============================================================
INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, suburb, city, province, postal_code, subtotal, delivery_fee, total, status)
VALUES ('eee00002-0000-0000-0000-000000000002', 'TEST-RECON-002', 'Recon Test 2', 'recon2@test.local', '0123', 'Addr', 'Suburb', 'City', 'Province', '0001', 479.00, 30.00, 509.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, store_id, product_name, size, colour, quantity, unit_price, line_total)
VALUES
  ('eee00002-0000-0000-0000-000000000011', 'eee00002-0000-0000-0000-000000000002', '966ccd62-1158-4119-ba7e-a9d04dc1b185', 'a1111111-1111-4111-8111-111111111111', 'Test Product 1', 'M', 'Black', 1, 100.00, 100.00),
  ('eee00002-0000-0000-0000-000000000012', 'eee00002-0000-0000-0000-000000000002', 'f678ed2b-caae-4436-9c19-9c5ec99d74bc', 'a3333333-3333-4333-8333-333333333333', 'Test Product 2', 'L', 'Blue', 1, 379.00, 379.00)
ON CONFLICT DO NOTHING;

INSERT INTO payment_transactions (id, order_id, reference, provider, amount, currency, status, verified_at)
VALUES ('eee00002-0000-0000-0000-000000000022', 'eee00002-0000-0000-0000-000000000002', 'test-recon-pay-002', 'paystack', 509.00, 'ZAR', 'success', now())
ON CONFLICT DO NOTHING;

SELECT process_order_post_payment('eee00002-0000-0000-0000-000000000002');

-- Verify: 2 earnings rows (one per item), gross = 479 = items total
SELECT
  o.order_number,
  (SELECT COUNT(*) FROM seller_earnings WHERE order_id = o.id) as earnings_count,
  (SELECT COUNT(DISTINCT store_id) FROM seller_earnings WHERE order_id = o.id) as store_count,
  (SELECT SUM(gross_amount) FROM seller_earnings WHERE order_id = o.id AND status != 'reversed') as gross_earnings,
  (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) as items_total,
  CASE
    WHEN (SELECT SUM(gross_amount) FROM seller_earnings WHERE order_id = o.id AND status != 'reversed') = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id)
      THEN 'MATCH' ELSE 'MISMATCH'
  END as totals_check
FROM orders o
WHERE o.id = 'eee00002-0000-0000-0000-000000000002';

-- ============================================================
-- TEST 3: Paid order with partial refund (no issues expected)
-- ============================================================
-- Use order from Test 1, create a partial refund of 50
INSERT INTO refunds (payment_transaction_id, order_id, paystack_refund_reference, amount, currency, status, verified_at, processed_by)
VALUES ('eee00001-0000-0000-0000-000000000021', 'eee00001-0000-0000-0000-000000000001', 'test-recon-refund-001', 50.00, 'ZAR', 'processed', now(), 'test')
ON CONFLICT DO NOTHING;

SELECT process_refund_notification(
  'test-recon-refund-001',
  'eee00001-0000-0000-0000-000000000001',
  50.00,
  '{"status": true, "data": {"status": "success"}}'::jsonb,
  true
);

-- Verify: order is partially_refunded, adjustment created
SELECT
  o.order_number,
  o.status as order_status,
  (SELECT SUM(amount) FROM refunds WHERE order_id = o.id AND status = 'processed') as processed_refund_total,
  (SELECT SUM(net_adjustment) FROM seller_earnings_adjustments WHERE order_id = o.id) as net_adjustment,
  (SELECT SUM(net_earnings) FROM seller_earnings WHERE order_id = o.id AND status != 'reversed') as original_net,
  (SELECT SUM(net_earnings) FROM seller_earnings WHERE order_id = o.id AND status != 'reversed')
    + COALESCE((SELECT SUM(net_adjustment) FROM seller_earnings_adjustments WHERE order_id = o.id), 0) as adjusted_net,
  CASE
    WHEN o.status IN ('refunded', 'partially_refunded') THEN 'STATUS_OK'
    ELSE 'STATUS_INCONSISTENCY'
  END as status_check
FROM orders o
WHERE o.id = 'eee00001-0000-0000-0000-000000000001';

-- ============================================================
-- TEST 4: Missing earnings — paid order with no earnings rows
-- ============================================================
INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, suburb, city, province, postal_code, subtotal, delivery_fee, total, status)
VALUES ('eee00004-0000-0000-0000-000000000004', 'TEST-RECON-004', 'Recon Test 4', 'recon4@test.local', '0123', 'Addr', 'Suburb', 'City', 'Province', '0001', 100.00, 30.00, 130.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, store_id, product_name, size, colour, quantity, unit_price, line_total)
VALUES ('eee00004-0000-0000-0000-000000000041', 'eee00004-0000-0000-0000-000000000004', '966ccd62-1158-4119-ba7e-a9d04dc1b185', 'a1111111-1111-4111-8111-111111111111', 'Test Product 1', 'M', 'Black', 1, 100.00, 100.00)
ON CONFLICT DO NOTHING;

INSERT INTO payment_transactions (id, order_id, reference, provider, amount, currency, status, verified_at)
VALUES ('eee00004-0000-0000-0000-000000000044', 'eee00004-0000-0000-0000-000000000004', 'test-recon-pay-004', 'paystack', 130.00, 'ZAR', 'success', now())
ON CONFLICT DO NOTHING;

-- Do NOT call process_order_post_payment — simulates missing earnings

SELECT
  o.order_number,
  o.status,
  (SELECT COUNT(*) FROM seller_earnings WHERE order_id = o.id) as earnings_count,
  CASE
    WHEN o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM seller_earnings WHERE order_id = o.id) THEN 'MISSING_EARNINGS_DETECTED'
    ELSE 'NOT_DETECTED'
  END as issue_check
FROM orders o
WHERE o.id = 'eee00004-0000-0000-0000-000000000004';

-- ============================================================
-- TEST 5: Duplicate earnings — two rows for same order_item_id
-- ============================================================
INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, suburb, city, province, postal_code, subtotal, delivery_fee, total, status)
VALUES ('eee00005-0000-0000-0000-000000000005', 'TEST-RECON-005', 'Recon Test 5', 'recon5@test.local', '0123', 'Addr', 'Suburb', 'City', 'Province', '0001', 100.00, 30.00, 130.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, store_id, product_name, size, colour, quantity, unit_price, line_total)
VALUES ('eee00005-0000-0000-0000-000000000051', 'eee00005-0000-0000-0000-000000000005', '966ccd62-1158-4119-ba7e-a9d04dc1b185', 'a1111111-1111-4111-8111-111111111111', 'Test Product 1', 'M', 'Black', 1, 100.00, 100.00)
ON CONFLICT DO NOTHING;

INSERT INTO payment_transactions (id, order_id, reference, provider, amount, currency, status, verified_at)
VALUES ('eee00005-0000-0000-0000-000000000055', 'eee00005-0000-0000-0000-000000000005', 'test-recon-pay-005', 'paystack', 130.00, 'ZAR', 'success', now())
ON CONFLICT DO NOTHING;

-- Insert duplicate earnings for the same order_item_id
INSERT INTO seller_earnings (seller_id, store_id, order_id, order_item_id, gross_amount, commission_rate, commission_amount, net_earnings, status)
VALUES
  ('fe793e60-39f2-41b5-9786-6caea8852f8f', 'a1111111-1111-4111-8111-111111111111', 'eee00005-0000-0000-0000-000000000005', 'eee00005-0000-0000-0000-000000000051', 100.00, 0.10, 10.00, 90.00, 'pending'),
  ('fe793e60-39f2-41b5-9786-6caea8852f8f', 'a1111111-1111-4111-8111-111111111111', 'eee00005-0000-0000-0000-000000000005', 'eee00005-0000-0000-0000-000000000051', 100.00, 0.10, 10.00, 90.00, 'pending')
ON CONFLICT DO NOTHING;

SELECT
  o.order_number,
  (SELECT COUNT(*) FROM seller_earnings se WHERE se.order_id = o.id AND se.order_item_id = 'eee00005-0000-0000-0000-000000000051') as earnings_for_item,
  CASE
    WHEN (SELECT COUNT(*) FROM seller_earnings se WHERE se.order_id = o.id AND se.order_item_id = 'eee00005-0000-0000-0000-000000000051') > 1 THEN 'DUPLICATE_DETECTED'
    ELSE 'NOT_DETECTED'
  END as issue_check
FROM orders o
WHERE o.id = 'eee00005-0000-0000-0000-000000000005';

-- ============================================================
-- TEST 6: Refund exceeds order total
-- ============================================================
INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, suburb, city, province, postal_code, subtotal, delivery_fee, total, status)
VALUES ('eee00006-0000-0000-0000-000000000006', 'TEST-RECON-006', 'Recon Test 6', 'recon6@test.local', '0123', 'Addr', 'Suburb', 'City', 'Province', '0001', 100.00, 30.00, 130.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, store_id, product_name, size, colour, quantity, unit_price, line_total)
VALUES ('eee00006-0000-0000-0000-000000000061', 'eee00006-0000-0000-0000-000000000006', '966ccd62-1158-4119-ba7e-a9d04dc1b185', 'a1111111-1111-4111-8111-111111111111', 'Test Product 1', 'M', 'Black', 1, 100.00, 100.00)
ON CONFLICT DO NOTHING;

INSERT INTO payment_transactions (id, order_id, reference, provider, amount, currency, status, verified_at)
VALUES ('eee00006-0000-0000-0000-000000000066', 'eee00006-0000-0000-0000-000000000006', 'test-recon-pay-006', 'paystack', 130.00, 'ZAR', 'success', now())
ON CONFLICT DO NOTHING;

SELECT process_order_post_payment('eee00006-0000-0000-0000-000000000006');

-- Insert a refund for 200 (exceeds order total of 130)
INSERT INTO refunds (payment_transaction_id, order_id, paystack_refund_reference, amount, currency, status, verified_at, processed_by)
VALUES ('eee00006-0000-0000-0000-000000000066', 'eee00006-0000-0000-0000-000000000006', 'test-recon-refund-006', 200.00, 'ZAR', 'processed', now(), 'test')
ON CONFLICT DO NOTHING;

SELECT
  o.order_number,
  o.total,
  (SELECT SUM(amount) FROM refunds WHERE order_id = o.id AND status = 'processed') as refund_total,
  CASE
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE order_id = o.id AND status = 'processed') > o.total THEN 'REFUND_EXCEEDS_DETECTED'
    ELSE 'NOT_DETECTED'
  END as issue_check
FROM orders o
WHERE o.id = 'eee00006-0000-0000-0000-000000000006';

-- ============================================================
-- TEST 7: Status inconsistency — processed refund but order still 'paid'
-- ============================================================
INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, suburb, city, province, postal_code, subtotal, delivery_fee, total, status)
VALUES ('eee00007-0000-0000-0000-000000000007', 'TEST-RECON-007', 'Recon Test 7', 'recon7@test.local', '0123', 'Addr', 'Suburb', 'City', 'Province', '0001', 100.00, 30.00, 130.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, store_id, product_name, size, colour, quantity, unit_price, line_total)
VALUES ('eee00007-0000-0000-0000-000000000071', 'eee00007-0000-0000-0000-000000000007', '966ccd62-1158-4119-ba7e-a9d04dc1b185', 'a1111111-1111-4111-8111-111111111111', 'Test Product 1', 'M', 'Black', 1, 100.00, 100.00)
ON CONFLICT DO NOTHING;

INSERT INTO payment_transactions (id, order_id, reference, provider, amount, currency, status, verified_at)
VALUES ('eee00007-0000-0000-0000-000000000077', 'eee00007-0000-0000-0000-000000000007', 'test-recon-pay-007', 'paystack', 130.00, 'ZAR', 'success', now())
ON CONFLICT DO NOTHING;

SELECT process_order_post_payment('eee00007-0000-0000-0000-000000000007');

-- Insert processed refund but DON'T call process_refund_notification (which would update order status)
-- This simulates a webhook that recorded the refund but failed to update the order status
INSERT INTO refunds (payment_transaction_id, order_id, paystack_refund_reference, amount, currency, status, verified_at, processed_by)
VALUES ('eee00007-0000-0000-0000-000000000077', 'eee00007-0000-0000-0000-000000000007', 'test-recon-refund-007', 130.00, 'ZAR', 'processed', now(), 'test')
ON CONFLICT DO NOTHING;

SELECT
  o.order_number,
  o.status as order_status,
  (SELECT COUNT(*) FROM refunds WHERE order_id = o.id AND status = 'processed') as processed_refund_count,
  CASE
    WHEN (SELECT COUNT(*) FROM refunds WHERE order_id = o.id AND status = 'processed') > 0
      AND o.status NOT IN ('refunded', 'partially_refunded') THEN 'INCONSISTENCY_DETECTED'
    ELSE 'NOT_DETECTED'
  END as issue_check
FROM orders o
WHERE o.id = 'eee00007-0000-0000-0000-000000000007';

-- ============================================================
-- TEST 8: Incomplete processing — paid order with no processing log
-- ============================================================
INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, suburb, city, province, postal_code, subtotal, delivery_fee, total, status)
VALUES ('eee00008-0000-0000-0000-000000000008', 'TEST-RECON-008', 'Recon Test 8', 'recon8@test.local', '0123', 'Addr', 'Suburb', 'City', 'Province', '0001', 100.00, 30.00, 130.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, store_id, product_name, size, colour, quantity, unit_price, line_total)
VALUES ('eee00008-0000-0000-0000-000000000081', 'eee00008-0000-0000-0000-000000000008', '966ccd62-1158-4119-ba7e-a9d04dc1b185', 'a1111111-1111-4111-8111-111111111111', 'Test Product 1', 'M', 'Black', 1, 100.00, 100.00)
ON CONFLICT DO NOTHING;

INSERT INTO payment_transactions (id, order_id, reference, provider, amount, currency, status, verified_at)
VALUES ('eee00008-0000-0000-0000-000000000088', 'eee00008-0000-0000-0000-000000000008', 'test-recon-pay-008', 'paystack', 130.00, 'ZAR', 'success', now())
ON CONFLICT DO NOTHING;

-- No process_order_post_payment call, no order_processing_log entry
SELECT
  o.order_number,
  o.status,
  (SELECT COUNT(*) FROM order_processing_log WHERE order_id = o.id) as processing_log_count,
  CASE
    WHEN o.status = 'paid' AND NOT EXISTS (
      SELECT 1 FROM order_processing_log opl
      WHERE opl.order_id = o.id AND opl.stock_decremented = true AND opl.earnings_created = true
    ) THEN 'INCOMPLETE_PROCESSING_DETECTED'
    ELSE 'NOT_DETECTED'
  END as issue_check
FROM orders o
WHERE o.id = 'eee00008-0000-0000-0000-000000000008';

-- ============================================================
-- CLEANUP: Remove all test data
-- ============================================================
DELETE FROM seller_earnings_adjustments WHERE order_id::text LIKE 'eee%';
DELETE FROM refunds WHERE order_id::text LIKE 'eee%';
DELETE FROM order_processing_log WHERE order_id::text LIKE 'eee%';
DELETE FROM seller_earnings WHERE order_id::text LIKE 'eee%';
DELETE FROM payment_transactions WHERE order_id::text LIKE 'eee%';
DELETE FROM order_items WHERE order_id::text LIKE 'eee%';
DELETE FROM orders WHERE id::text LIKE 'eee%';

SELECT 'All reconciliation tests completed and cleaned up' as result;
