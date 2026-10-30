/*
# Add partially_refunded to orders status CHECK constraint

## Problem
The orders table already had a CHECK constraint named orders_status_check
that only allowed: pending, paid, cancelled, failed, refunded.
The 'partially_refunded' status was missing.

## Fix
Drop the existing constraint and recreate it with 'partially_refunded' included.
No data is affected — only the constraint definition changes.
*/

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'cancelled', 'failed', 'refunded', 'partially_refunded'));