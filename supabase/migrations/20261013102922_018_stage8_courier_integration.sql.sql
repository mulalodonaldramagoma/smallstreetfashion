/*
# Stage 8: Courier Integration — Shipment Management

## Overview
Adds courier provider configuration, shipment records, and tracking event history
for modular courier integration. This is additive — no existing tables modified.

## New Tables
1. courier_providers — courier config (demo or live), with tracking URL template
2. shipments — links delivery to courier shipment, one active per delivery
3. shipment_tracking_events — immutable tracking event audit log

## Security
- courier_providers: public read (for tracking display), admin-only write
- shipments: customer reads own, seller reads their store's, admin reads all; seller/admin insert+update
- shipment_tracking_events: same read pattern; seller/admin insert; no update/delete (immutable)
- insert_tracking_event function: service_role only (called from edge functions)
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

DROP POLICY IF EXISTS "courier_providers_public_read" ON courier_providers;
CREATE POLICY "courier_providers_public_read"
  ON courier_providers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "courier_providers_admin_insert" ON courier_providers;
CREATE POLICY "courier_providers_admin_insert"
  ON courier_providers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "courier_providers_admin_update" ON courier_providers;
CREATE POLICY "courier_providers_admin_update"
  ON courier_providers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "courier_providers_admin_delete" ON courier_providers;
CREATE POLICY "courier_providers_admin_delete"
  ON courier_providers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

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

CREATE UNIQUE INDEX IF NOT EXISTS one_active_shipment_per_delivery
  ON shipments(delivery_id) WHERE cancelled_at IS NULL;

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipments_select_customer" ON shipments;
CREATE POLICY "shipments_select_customer"
  ON shipments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = shipments.order_id AND orders.user_id = auth.uid()));

DROP POLICY IF EXISTS "shipments_select_seller" ON shipments;
CREATE POLICY "shipments_select_seller"
  ON shipments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE o.id = shipments.order_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "shipments_select_admin" ON shipments;
CREATE POLICY "shipments_select_admin"
  ON shipments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "shipments_insert_seller" ON shipments;
CREATE POLICY "shipments_insert_seller"
  ON shipments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE o.id = shipments.order_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "shipments_insert_admin" ON shipments;
CREATE POLICY "shipments_insert_admin"
  ON shipments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "shipments_update_seller" ON shipments;
CREATE POLICY "shipments_update_seller"
  ON shipments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE o.id = shipments.order_id AND s.seller_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE o.id = shipments.order_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "shipments_update_admin" ON shipments;
CREATE POLICY "shipments_update_admin"
  ON shipments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

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

DROP POLICY IF EXISTS "tracking_events_select_customer" ON shipment_tracking_events;
CREATE POLICY "tracking_events_select_customer"
  ON shipment_tracking_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM shipments sh
    JOIN orders o ON o.id = sh.order_id
    WHERE sh.id = shipment_tracking_events.shipment_id AND o.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "tracking_events_select_seller" ON shipment_tracking_events;
CREATE POLICY "tracking_events_select_seller"
  ON shipment_tracking_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM shipments sh
    JOIN orders o ON o.id = sh.order_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE sh.id = shipment_tracking_events.shipment_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "tracking_events_select_admin" ON shipment_tracking_events;
CREATE POLICY "tracking_events_select_admin"
  ON shipment_tracking_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "tracking_events_insert_seller" ON shipment_tracking_events;
CREATE POLICY "tracking_events_insert_seller"
  ON shipment_tracking_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM shipments sh
    JOIN orders o ON o.id = sh.order_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE sh.id = shipment_tracking_events.shipment_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "tracking_events_insert_admin" ON shipment_tracking_events;
CREATE POLICY "tracking_events_insert_admin"
  ON shipment_tracking_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- No update or delete policies — tracking events are immutable

-- 4. Updated_at triggers
CREATE OR REPLACE FUNCTION update_courier_providers_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS courier_providers_updated_at ON courier_providers;
CREATE TRIGGER courier_providers_updated_at BEFORE UPDATE ON courier_providers FOR EACH ROW EXECUTE FUNCTION update_courier_providers_updated_at();

CREATE OR REPLACE FUNCTION update_shipments_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS shipments_updated_at ON shipments;
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_shipments_updated_at();

-- 5. Seed Demo Courier provider
INSERT INTO courier_providers (code, name, is_active, is_demo, tracking_url_template)
VALUES ('demo_courier', 'Demo Courier (Test Mode)', true, true, 'https://track.example.com/track/{tracking_number}')
ON CONFLICT (code) DO NOTHING;

-- 6. insert_tracking_event function (service_role only)
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
DECLARE v_event_id uuid;
BEGIN
  INSERT INTO shipment_tracking_events (shipment_id, status, description, location, event_timestamp, source, raw_payload)
  VALUES (p_shipment_id, p_status, p_description, p_location, p_event_timestamp, p_source, p_raw_payload)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION insert_tracking_event(uuid, text, text, text, timestamptz, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION insert_tracking_event(uuid, text, text, text, timestamptz, text, jsonb) TO service_role;
