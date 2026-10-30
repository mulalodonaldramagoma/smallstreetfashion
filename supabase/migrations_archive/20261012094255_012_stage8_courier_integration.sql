/*
# Stage 8: Courier Integration — Shipment Management

## Overview
Adds courier provider configuration, shipment records, and tracking event history
to support modular courier integration. Existing delivery management (Stage 7)
continues to work unchanged. Pickup and manually arranged deliveries remain
fully functional with or without a courier provider configured.

## New Tables

### 1. courier_providers
Stores configuration for each courier provider (demo or live).
- id (uuid PK)
- code (text, unique) — machine identifier e.g. "demo_courier", "px_ardent"
- name (text) — display name e.g. "Demo Courier", "Ardent Express"
- is_active (boolean, default false)
- is_demo (boolean, default false) — flags demo/test adapters
- tracking_url_template (text, nullable) — e.g. "https://example.com/track/{tracking_number}"
- config (jsonb, default '{}') — non-secret provider settings
- created_at, updated_at (timestamptz)

### 2. shipments
Links an order/delivery to a courier shipment. One active shipment per order;
replacements allowed via cancellation + new creation.
- id (uuid PK)
- delivery_id (uuid FK → deliveries, NOT NULL)
- order_id (uuid FK → orders, NOT NULL)
- courier_provider_id (uuid FK → courier_providers, NOT NULL)
- shipment_reference (text) — provider's internal shipment ID
- tracking_number (text, nullable) — public tracking number
- status (text, default 'created') — shipment lifecycle
- tracking_url (text, nullable) — full URL for customer tracking
- created_by (uuid, nullable) — user who created the shipment
- cancelled_at (timestamptz, nullable)
- cancelled_by (uuid, nullable)
- created_at, updated_at (timestamptz)

### 3. shipment_tracking_events
Immutable audit log of tracking updates from couriers or manual entry.
- id (uuid PK)
- shipment_id (uuid FK → shipments, NOT NULL)
- status (text, NOT NULL) — event status from courier
- description (text, nullable) — human-readable event description
- location (text, nullable) — where the event occurred
- event_timestamp (timestamptz, NOT NULL) — when the courier says it happened
- received_at (timestamptz, default now()) — when we recorded it
- source (text, default 'manual') — 'webhook', 'poll', 'manual'
- raw_payload (jsonb, nullable) — full webhook payload for audit

## Security
- courier_providers: public read (anon + authenticated can see provider names for
  tracking display); admin-only write.
- shipments: customer sees shipments for their own orders; seller sees shipments
  for orders containing their products; admin sees all. Seller/admin can create
  and update; customer is read-only.
- shipment_tracking_events: same read access as shipments; inserts via service
  role (edge functions) or seller/admin manual entry; no updates or deletes
  (immutable audit log).

## Important Notes
1. Payment status (orders.status) remains completely separate from shipment status.
2. No existing tables are modified — all new tables are additive.
3. A seed "Demo Courier" provider is inserted with is_demo = true.
4. Unique constraint on shipments prevents duplicate active shipments per delivery.
*/

-- 1. courier_providers table
CREATE TABLE IF NOT EXISTS courier_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  tracking_url_template text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE courier_providers ENABLE ROW LEVEL SECURITY;

-- courier_providers: public read (needed for tracking display)
DROP POLICY IF EXISTS "courier_providers_public_read" ON courier_providers;
CREATE POLICY "courier_providers_public_read"
  ON courier_providers FOR SELECT
  TO anon, authenticated
  USING (true);

-- courier_providers: admin-only write
DROP POLICY IF EXISTS "courier_providers_admin_insert" ON courier_providers;
CREATE POLICY "courier_providers_admin_insert"
  ON courier_providers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "courier_providers_admin_update" ON courier_providers;
CREATE POLICY "courier_providers_admin_update"
  ON courier_providers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "courier_providers_admin_delete" ON courier_providers;
CREATE POLICY "courier_providers_admin_delete"
  ON courier_providers FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- 2. shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  courier_provider_id uuid NOT NULL REFERENCES courier_providers(id),
  shipment_reference text NOT NULL,
  tracking_number text,
  status text NOT NULL DEFAULT 'created',
  tracking_url text,
  created_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One active (non-cancelled) shipment per delivery
CREATE UNIQUE INDEX IF NOT EXISTS one_active_shipment_per_delivery
  ON shipments(delivery_id)
  WHERE cancelled_at IS NULL;

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- shipments: customer sees own
DROP POLICY IF EXISTS "shipments_select_customer" ON shipments;
CREATE POLICY "shipments_select_customer"
  ON shipments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = shipments.order_id AND orders.user_id = auth.uid()
    )
  );

-- shipments: seller sees shipments for their store's orders
DROP POLICY IF EXISTS "shipments_select_seller" ON shipments;
CREATE POLICY "shipments_select_seller"
  ON shipments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN stores s ON s.id = oi.store_id
      WHERE o.id = shipments.order_id AND s.seller_id = auth.uid()
    )
  );

-- shipments: admin sees all
DROP POLICY IF EXISTS "shipments_select_admin" ON shipments;
CREATE POLICY "shipments_select_admin"
  ON shipments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- shipments: seller can create for their store's orders, admin can create for any
DROP POLICY IF EXISTS "shipments_insert_seller" ON shipments;
CREATE POLICY "shipments_insert_seller"
  ON shipments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN stores s ON s.id = oi.store_id
      WHERE o.id = shipments.order_id AND s.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "shipments_insert_admin" ON shipments;
CREATE POLICY "shipments_insert_admin"
  ON shipments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- shipments: seller can update for their store's orders, admin can update any
DROP POLICY IF EXISTS "shipments_update_seller" ON shipments;
CREATE POLICY "shipments_update_seller"
  ON shipments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN stores s ON s.id = oi.store_id
      WHERE o.id = shipments.order_id AND s.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN stores s ON s.id = oi.store_id
      WHERE o.id = shipments.order_id AND s.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "shipments_update_admin" ON shipments;
CREATE POLICY "shipments_update_admin"
  ON shipments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- 3. shipment_tracking_events table
CREATE TABLE IF NOT EXISTS shipment_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status text NOT NULL,
  description text,
  location text,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  raw_payload jsonb
);

ALTER TABLE shipment_tracking_events ENABLE ROW LEVEL SECURITY;

-- tracking events: same read access as shipments
DROP POLICY IF EXISTS "tracking_events_select_customer" ON shipment_tracking_events;
CREATE POLICY "tracking_events_select_customer"
  ON shipment_tracking_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments sh
      JOIN orders o ON o.id = sh.order_id
      WHERE sh.id = shipment_tracking_events.shipment_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tracking_events_select_seller" ON shipment_tracking_events;
CREATE POLICY "tracking_events_select_seller"
  ON shipment_tracking_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments sh
      JOIN orders o ON o.id = sh.order_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN stores s ON s.id = oi.store_id
      WHERE sh.id = shipment_tracking_events.shipment_id AND s.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tracking_events_select_admin" ON shipment_tracking_events;
CREATE POLICY "tracking_events_select_admin"
  ON shipment_tracking_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- tracking events: seller/admin can insert manual events
DROP POLICY IF EXISTS "tracking_events_insert_seller" ON shipment_tracking_events;
CREATE POLICY "tracking_events_insert_seller"
  ON shipment_tracking_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shipments sh
      JOIN orders o ON o.id = sh.order_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN stores s ON s.id = oi.store_id
      WHERE sh.id = shipment_tracking_events.shipment_id AND s.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tracking_events_insert_admin" ON shipment_tracking_events;
CREATE POLICY "tracking_events_insert_admin"
  ON shipment_tracking_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- No update or delete policies — tracking events are immutable

-- 4. Updated_at triggers
CREATE OR REPLACE FUNCTION update_courier_providers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courier_providers_updated_at ON courier_providers;
CREATE TRIGGER courier_providers_updated_at
  BEFORE UPDATE ON courier_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_courier_providers_updated_at();

CREATE OR REPLACE FUNCTION update_shipments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipments_updated_at ON shipments;
CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_shipments_updated_at();

-- 5. Seed Demo Courier provider
INSERT INTO courier_providers (code, name, is_active, is_demo, tracking_url_template)
VALUES (
  'demo_courier',
  'Demo Courier (Test Mode)',
  true,
  true,
  'https://track.example.com/track/{tracking_number}'
)
ON CONFLICT (code) DO NOTHING;

-- 6. Create initial tracking event for a shipment function
-- Used by edge functions to insert tracking events safely
CREATE OR REPLACE FUNCTION insert_tracking_event(
  p_shipment_id uuid,
  p_status text,
  p_description text,
  p_location text DEFAULT NULL,
  p_event_timestamp timestamptz DEFAULT now(),
  p_source text DEFAULT 'manual',
  p_raw_payload jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO shipment_tracking_events (
    shipment_id, status, description, location,
    event_timestamp, source, raw_payload
  )
  VALUES (
    p_shipment_id, p_status, p_description, p_location,
    p_event_timestamp, p_source, p_raw_payload
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;
