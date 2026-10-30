/*
# C3: Delivery and Shipment Status CHECK Constraints

## Problem
The deliveries, delivery_status_history, and shipments tables are created
with status columns of type text but no CHECK constraint restricting the
allowed values. This allows any string to be written, which could cause
application errors or data corruption.

## Fix
Add CHECK constraints using the exact status values from the application's
TypeScript types (src/types/index.ts):

  DeliveryStatus (lines 195-204):
    awaiting_fulfilment, processing, packed, ready_for_collection,
    dispatched, in_transit, delivered, delivery_failed, cancelled

  Note: The deliveries table is seeded with default 'pending' in Step 11
  (009_stage7_delivery_management_step1_tables.sql, line 92). The value
  'pending' is NOT in the DeliveryStatus type but is used as the initial
  default. It is included in the CHECK to avoid breaking the seed insert,
  and will be updated to 'awaiting_fulfilment' by the application after
  the delivery is processed.

  ShipmentStatus (lines 273-281):
    created, pending_pickup, picked_up, in_transit, out_for_delivery,
    delivered, failed, cancelled

## Tables covered
- deliveries.status
- delivery_status_history.status
- shipments.status

  shipment_tracking_events.status is intentionally NOT constrained because
  it stores free-form courier status strings from external webhook payloads.

## Safety
- Uses DO $$ blocks to check whether each constraint already exists before
  adding, making the migration safe to re-run.
- All three tables are created by earlier steps in the execution plan
  (deliveries + delivery_status_history by Steps 11-12, shipments by Step 14).
- No existing data is modified. If existing rows contain invalid status
  values, the ADD CONSTRAINT will fail, surfacing the problem.
  However, since these constraints are applied immediately after the tables
  are created (no rows except the seed 'pending' delivery), no violations
  are expected.
*/

-- ============================================================
-- 1. deliveries.status CHECK
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deliveries_status_check'
      AND table_name = 'deliveries'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check
      CHECK (status IN (
        'pending',
        'awaiting_fulfilment',
        'processing',
        'packed',
        'ready_for_collection',
        'dispatched',
        'in_transit',
        'delivered',
        'delivery_failed',
        'cancelled'
      ));
  END IF;
END $$;

-- ============================================================
-- 2. delivery_status_history.status CHECK
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'delivery_status_history_status_check'
      AND table_name = 'delivery_status_history'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE delivery_status_history ADD CONSTRAINT delivery_status_history_status_check
      CHECK (status IN (
        'pending',
        'awaiting_fulfilment',
        'processing',
        'packed',
        'ready_for_collection',
        'dispatched',
        'in_transit',
        'delivered',
        'delivery_failed',
        'cancelled'
      ));
  END IF;
END $$;

-- ============================================================
-- 3. shipments.status CHECK
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shipments_status_check'
      AND table_name = 'shipments'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
      CHECK (status IN (
        'created',
        'pending_pickup',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'failed',
        'cancelled'
      ));
  END IF;
END $$;