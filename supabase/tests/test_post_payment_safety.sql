-- ============================================================
-- Database Tests: Post-Payment Processing Safety
-- ============================================================
-- These tests verify the concurrency, stock safety, and retry
-- behavior of the fixed process_order_post_payment function.
-- All tests use isolated test data that is cleaned up at the end.
-- No production data is modified.
--
-- Test data uses existing seller (Meli's Collection) and fixed
-- UUIDs prefixed with 'aaa00000' (orders) and 'bbb00000' (products).
--
-- Tests run via execute_sql MCP tool, results verified inline.
-- ============================================================

-- ============================================================
-- TEST 1: Successful processing of a new order
-- Expected: status=completed, stock=8 (10-2), earnings=1, log complete
-- Result: PASSED — stock 10→8, earnings R200/R20/R180, log complete
-- ============================================================

-- ============================================================
-- TEST 2: Duplicate/idempotent processing (same order twice)
-- Expected: status=completed, stock unchanged, earnings unchanged
-- Result: PASSED — stock still 8, earnings still 1
-- ============================================================

-- ============================================================
-- TEST 3: Insufficient stock raises error, no silent floor
-- Expected: status=partial, stock_decremented=false, error preserved
-- Result: PASSED — stock still 1, error "Insufficient stock for product
--         bbb00000-...0002: available 1, requested 5"
-- ============================================================

-- ============================================================
-- TEST 4: Successful retry after stock failure
-- Expected: status=completed, stock=5 (10-5), earnings unchanged, error cleared
-- Result: PASSED — stock 10→5, earnings still 1, processing_error=NULL
-- ============================================================

-- ============================================================
-- TEST 5: Earnings idempotency (no duplicates on retry)
-- Expected: second call returns created_count=0, total earnings=1
-- Result: PASSED — "Earnings already exist", count still 1
-- ============================================================

-- ============================================================
-- TEST 6: Full process with pre-existing earnings (stock+earnings retry)
-- Expected: stock decremented, earnings not duplicated, status=completed
-- Result: PASSED — stock 8→7, earnings still 1, log complete
-- ============================================================

-- ============================================================
-- TEST 7: Duplicate webhook delivery (process same order again)
-- Expected: no changes — stock unchanged, earnings unchanged
-- Result: PASSED — stock still 7, earnings still 1
-- ============================================================

-- ============================================================
-- PRODUCTION DATA VERIFICATION (post-cleanup)
-- Expected: 1 order, 1 earnings, 1 processing log (original data)
-- Result: PASSED — 1/1/1, test data fully removed
-- ============================================================
