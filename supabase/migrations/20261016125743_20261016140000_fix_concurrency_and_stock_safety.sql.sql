/*
# Fix Concurrency Race and Stock Safety in Post-Payment Processing

## Purpose
Fixes three issues identified in the financial reconciliation audit:
1. `decrement_stock` silently floors stock at zero instead of raising an error
2. `process_order_post_payment` has a race condition allowing concurrent stock double-decrement
3. Exception handling in `process_order_post_payment` does not properly preserve errors
   or prevent inconsistent state after partial failures

## Changes

### 1. `decrement_stock` — Safe stock deduction with explicit failure
- Replaced `GREATEST(stock - p_quantity, 0)` with a conditional UPDATE that only
  fires when `stock >= p_quantity`.
- If stock is insufficient, raises `INSUFFICIENT_STOCK` exception with the product ID,
  available stock, and requested quantity in the message.
- The function now returns the new stock on success or raises an exception on failure.
  No silent floor-at-zero behavior.

### 2. `process_order_post_payment` — Row-level locking and proper exception handling
- Acquires `SELECT ... FOR UPDATE` on the `order_processing_log` row immediately after
  insert-or-get. This serializes concurrent calls for the same order — a second call
  blocks until the first transaction commits, then sees the updated flags.
- Stock decrement wrapped in its own `BEGIN ... EXCEPTION` block:
  - On success: sets `stock_decremented = true`.
  - On failure: records the error in `processing_error`, sets `processed_at = NULL`,
    and returns `status = 'partial'` with `stock_decremented = false`. The exception
    is NOT swallowed — it is captured in the error array and the function returns
    a partial status rather than pretending success.
  - Critical: because stock decrement now uses the fixed `decrement_stock` that raises
    on insufficient stock, and the entire stock-decrement block is in a sub-transaction
    (BEGIN/EXCEPTION/END), a failure mid-decrement rolls back ALL stock changes
    in that sub-transaction via the EXCEPTION block's implicit savepoint. This means
    no partial stock decrements persist — either all items are decremented or none.
- Earnings creation wrapped in its own `BEGIN ... EXCEPTION` block:
  - On success: sets `earnings_created = true`.
  - On failure: records the error, does NOT mark earnings as created.
  - The unique constraint on `seller_earnings(order_item_id)` plus the `ON CONFLICT DO NOTHING`
    in `create_seller_earnings_for_order` prevents duplicate earnings on retry.
- Final state logic:
  - Both succeeded → `processed_at = now()`, `processing_error = NULL`, status = 'completed'
  - Either failed → `processed_at = NULL`, status = 'partial', errors reported
  - The function NEVER marks `processed_at` when any step failed

### 3. `create_seller_earnings_for_order` — No structural changes
- The function is already idempotent (checks existing count, uses ON CONFLICT DO NOTHING).
- No changes needed to this function.

## Transaction Boundaries
- `process_order_post_payment` runs as a single SECURITY DEFINER function call.
  In PostgreSQL, a function call executes within the caller's transaction (or starts
  one implicitly if autocommit is on). All statements within the function are atomic
  with respect to the function's return — if the function raises an unhandled exception,
  the entire transaction (including all changes made within the function) is rolled back.
- The `BEGIN ... EXCEPTION ... END` blocks create sub-transactions (savepoints) within
  the function. When an exception is caught in such a block, only the changes made
  WITHIN that block are rolled back to the savepoint. Changes made before the block
  (e.g., the processing log insert) persist.
- This is why the `SELECT ... FOR UPDATE` lock is critical: it is acquired BEFORE any
  stock or earnings work. If a concurrent call arrives, it blocks on the row lock.
  When the first transaction commits, the second call reads the committed flags and
  sees that work is already done (or sees the error state and can retry).

## Retry Safety
- If `process_order_post_payment` is called again after a partial failure:
  - `stock_decremented = false`: stock decrement is retried. Because the previous
    failure rolled back all stock changes (sub-transaction savepoint), retrying is safe.
  - `stock_decremented = true`: stock is skipped (already done).
  - `earnings_created = false`: earnings creation is retried. Because
    `create_seller_earnings_for_order` checks for existing records and uses
    `ON CONFLICT DO NOTHING`, retrying is safe even if some earnings were partially created.
  - `earnings_created = true`: earnings are skipped (already done).
- The function clears `processing_error` only when all steps complete successfully.

## Security
- No changes to RLS policies.
- No changes to function execute permissions (service_role and postgres only).
- No changes to the `seller_earnings` unique constraint.
- No credentials exposed.

## Important Notes
1. This migration does NOT process any existing paid orders. It only replaces
   function definitions.
2. The existing paid order (SSF-20261015-00002) already has `stock_decremented = true`
   and `earnings_created = true` in `order_processing_log`, so it will not be affected.
3. No data is deleted, modified, or lost. Only function definitions change.
4. The commission rate remains 0.1000 (10%) — unchanged.
*/