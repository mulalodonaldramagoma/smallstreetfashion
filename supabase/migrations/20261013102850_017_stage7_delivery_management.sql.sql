/*
# Stage 7: Delivery Management Tables

## Overview
Creates delivery_methods and deliveries tables with full RLS policies.
Also adds delivery_method_id to orders table.
Seeds default delivery methods (Standard, Express, Store Pickup).

## New Tables
1. delivery_methods — delivery options with fees, types (delivery/pickup), zone links
2. deliveries — delivery records linked to orders, with status tracking
3. delivery_zones — configurable delivery zones for Johannesburg CBD
4. delivery_status_history — immutable log of delivery status changes

## Modified Tables
- orders: adds delivery_method_id (nullable FK)

## Security
- delivery_methods: public read, admin-only write
- delivery_zones: public read, admin-only write
- deliveries: customer reads own, seller reads their store's, admin reads all; seller/admin update
- delivery_status_history: same read access pattern; seller/admin insert, admin delete
*/
-- 1. delivery_methods table
CREATE TABLE IF NOT EXISTS delivery_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  fee numeric NOT NULL DEFAULT 0,
  estimated_days text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'delivery' CHECK (type IN ('delivery', 'pickup')),
  zone_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_methods_public_read" ON delivery_methods;
CREATE POLICY "delivery_methods_public_read"
  ON delivery_methods FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "delivery_methods_admin_insert" ON delivery_methods;
CREATE POLICY "delivery_methods_admin_insert"
  ON delivery_methods FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "delivery_methods_admin_update" ON delivery_methods;
CREATE POLICY "delivery_methods_admin_update"
  ON delivery_methods FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "delivery_methods_admin_delete" ON delivery_methods;
CREATE POLICY "delivery_methods_admin_delete"
  ON delivery_methods FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 2. delivery_zones table
CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  base_fee numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_zones_public_read" ON delivery_zones;
CREATE POLICY "delivery_zones_public_read"
  ON delivery_zones FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "delivery_zones_admin_insert" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_insert"
  ON delivery_zones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "delivery_zones_admin_update" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_update"
  ON delivery_zones FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "delivery_zones_admin_delete" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_delete"
  ON delivery_zones FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Add zone_id FK to delivery_methods
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_methods' AND column_name = 'zone_id') THEN
    ALTER TABLE delivery_methods ADD COLUMN zone_id uuid REFERENCES delivery_zones(id);
  END IF;
END $$;

-- 3. Add delivery_method_id to orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_method_id') THEN
    ALTER TABLE orders ADD COLUMN delivery_method_id uuid REFERENCES delivery_methods(id);
  END IF;
END $$;

-- 4. deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_method_id uuid REFERENCES delivery_methods(id),
  delivery_fee numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'awaiting_fulfilment',
  tracking_note text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  zone_id uuid REFERENCES delivery_zones(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select_customer" ON deliveries;
CREATE POLICY "deliveries_select_customer"
  ON deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = deliveries.order_id AND orders.user_id = auth.uid()));

DROP POLICY IF EXISTS "deliveries_select_seller" ON deliveries;
CREATE POLICY "deliveries_select_seller"
  ON deliveries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE o.id = deliveries.order_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "deliveries_select_admin" ON deliveries;
CREATE POLICY "deliveries_select_admin"
  ON deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "deliveries_update_seller" ON deliveries;
CREATE POLICY "deliveries_update_seller"
  ON deliveries FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE o.id = deliveries.order_id AND s.seller_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE o.id = deliveries.order_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "deliveries_update_admin" ON deliveries;
CREATE POLICY "deliveries_update_admin"
  ON deliveries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "deliveries_delete_admin" ON deliveries;
CREATE POLICY "deliveries_delete_admin"
  ON deliveries FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 5. delivery_status_history table
CREATE TABLE IF NOT EXISTS delivery_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dsh_select_customer" ON delivery_status_history;
CREATE POLICY "dsh_select_customer"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM deliveries d
    JOIN orders o ON o.id = d.order_id
    WHERE d.id = delivery_status_history.delivery_id AND o.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "dsh_select_seller" ON delivery_status_history;
CREATE POLICY "dsh_select_seller"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM deliveries d
    JOIN orders o ON o.id = d.order_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE d.id = delivery_status_history.delivery_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "dsh_select_admin" ON delivery_status_history;
CREATE POLICY "dsh_select_admin"
  ON delivery_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "dsh_insert_seller" ON delivery_status_history;
CREATE POLICY "dsh_insert_seller"
  ON delivery_status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM deliveries d
    JOIN orders o ON o.id = d.order_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN stores s ON s.id = oi.store_id
    WHERE d.id = delivery_status_history.delivery_id AND s.seller_id = auth.uid()
  ));

DROP POLICY IF EXISTS "dsh_insert_admin" ON delivery_status_history;
CREATE POLICY "dsh_insert_admin"
  ON delivery_status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "dsh_delete_admin" ON delivery_status_history;
CREATE POLICY "dsh_delete_admin"
  ON delivery_status_history FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 6. Updated_at triggers (with explicit search_path)
CREATE OR REPLACE FUNCTION update_deliveries_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS deliveries_updated_at ON deliveries;
CREATE TRIGGER deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_deliveries_updated_at();

CREATE OR REPLACE FUNCTION update_delivery_methods_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS delivery_methods_updated_at ON delivery_methods;
CREATE TRIGGER delivery_methods_updated_at BEFORE UPDATE ON delivery_methods FOR EACH ROW EXECUTE FUNCTION update_delivery_methods_updated_at();

CREATE OR REPLACE FUNCTION update_delivery_zones_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS delivery_zones_updated_at ON delivery_zones;
CREATE TRIGGER delivery_zones_updated_at BEFORE UPDATE ON delivery_zones FOR EACH ROW EXECUTE FUNCTION update_delivery_zones_updated_at();

-- 7. Seed delivery methods
INSERT INTO delivery_methods (name, description, fee, estimated_days, is_active, sort_order, type)
SELECT 'Standard Delivery', 'Delivered within 3-5 business days', 65, '3-5 business days', true, 1, 'delivery'
WHERE NOT EXISTS (SELECT 1 FROM delivery_methods WHERE name = 'Standard Delivery');

INSERT INTO delivery_methods (name, description, fee, estimated_days, is_active, sort_order, type)
SELECT 'Express Delivery', 'Delivered within 1-2 business days', 120, '1-2 business days', true, 2, 'delivery'
WHERE NOT EXISTS (SELECT 1 FROM delivery_methods WHERE name = 'Express Delivery');

INSERT INTO delivery_methods (name, description, fee, estimated_days, is_active, sort_order, type)
SELECT 'Store Pickup', 'Collect your order from the store', 0, 'Ready within 24 hours', true, 3, 'pickup'
WHERE NOT EXISTS (SELECT 1 FROM delivery_methods WHERE name = 'Store Pickup');

-- 8. Seed delivery zones
INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order)
SELECT 'Johannesburg CBD', 'Central Johannesburg delivery zone', 65, true, 1
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Johannesburg CBD');

INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order)
SELECT 'Sandton & Rosebank', 'Northern suburbs delivery zone', 85, true, 2
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Sandton & Rosebank');

INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order)
SELECT 'Soweto & South', 'Southern areas delivery zone', 75, true, 3
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Soweto & South');

INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order)
SELECT 'East Rand', 'Ekurhuleni delivery zone', 95, true, 4
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'East Rand');

INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order)
SELECT 'West Rand', 'Western areas delivery zone', 95, true, 5
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'West Rand');

INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order)
SELECT 'Pretoria & Tshwane', 'Tshwane delivery zone', 110, true, 6
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Pretoria & Tshwane');

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status_history_delivery_id ON delivery_status_history(delivery_id);
