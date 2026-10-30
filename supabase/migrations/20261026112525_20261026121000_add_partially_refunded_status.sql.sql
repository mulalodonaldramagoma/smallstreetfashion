-- Add partially_refunded to orders status CHECK constraint (migration 6)
-- The constraint already exists from migration 4's DO block, but only
-- with the original values. Drop and recreate it to ensure
-- 'partially_refunded' is explicitly included.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'cancelled', 'failed', 'refunded', 'partially_refunded'));
