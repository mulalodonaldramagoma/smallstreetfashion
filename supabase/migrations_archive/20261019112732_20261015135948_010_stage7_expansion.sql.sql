-- Stage 7 Expansion: delivery zones, status history, method types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_methods' AND column_name = 'type') THEN
    ALTER TABLE delivery_methods ADD COLUMN type text NOT NULL DEFAULT 'delivery';
    ALTER TABLE delivery_methods ADD CONSTRAINT delivery_methods_type_check CHECK (type IN ('delivery', 'pickup'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text, base_fee numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_zones_public_read" ON delivery_zones;
CREATE POLICY "delivery_zones_public_read" ON delivery_zones FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "delivery_zones_admin_insert" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_insert" ON delivery_zones FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
DROP POLICY IF EXISTS "delivery_zones_admin_update" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_update" ON delivery_zones FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
DROP POLICY IF EXISTS "delivery_zones_admin_delete" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_delete" ON delivery_zones FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE OR REPLACE FUNCTION update_delivery_zones_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS delivery_zones_updated_at ON delivery_zones;
CREATE TRIGGER delivery_zones_updated_at BEFORE UPDATE ON delivery_zones FOR EACH ROW EXECUTE FUNCTION update_delivery_zones_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_methods' AND column_name = 'zone_id') THEN
    ALTER TABLE delivery_methods ADD COLUMN zone_id uuid REFERENCES delivery_zones(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'cancelled_at') THEN
    ALTER TABLE deliveries ADD COLUMN cancelled_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'failed_at') THEN
    ALTER TABLE deliveries ADD COLUMN failed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'zone_id') THEN
    ALTER TABLE deliveries ADD COLUMN zone_id uuid REFERENCES delivery_zones(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS delivery_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status text NOT NULL, note text, changed_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE delivery_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dsh_select_customer" ON delivery_status_history;
CREATE POLICY "dsh_select_customer" ON delivery_status_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM deliveries d JOIN orders o ON o.id = d.order_id WHERE d.id = delivery_status_history.delivery_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "dsh_select_seller" ON delivery_status_history;
CREATE POLICY "dsh_select_seller" ON delivery_status_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM deliveries d JOIN orders o ON o.id = d.order_id JOIN order_items oi ON oi.order_id = o.id JOIN stores s ON s.id = oi.store_id WHERE d.id = delivery_status_history.delivery_id AND s.seller_id = auth.uid()));
DROP POLICY IF EXISTS "dsh_select_admin" ON delivery_status_history;
CREATE POLICY "dsh_select_admin" ON delivery_status_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
DROP POLICY IF EXISTS "dsh_insert_seller" ON delivery_status_history;
CREATE POLICY "dsh_insert_seller" ON delivery_status_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM deliveries d JOIN orders o ON o.id = d.order_id JOIN order_items oi ON oi.order_id = o.id JOIN stores s ON s.id = oi.store_id WHERE d.id = delivery_status_history.delivery_id AND s.seller_id = auth.uid()));
DROP POLICY IF EXISTS "dsh_insert_admin" ON delivery_status_history;
CREATE POLICY "dsh_insert_admin" ON delivery_status_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
DROP POLICY IF EXISTS "dsh_delete_admin" ON delivery_status_history;
CREATE POLICY "dsh_delete_admin" ON delivery_status_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

UPDATE delivery_methods SET type = 'pickup' WHERE name = 'Store Pickup';
INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order) SELECT 'Johannesburg CBD', 'Central Johannesburg delivery zone', 65, true, 1 WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Johannesburg CBD');
INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order) SELECT 'Sandton & Rosebank', 'Northern suburbs delivery zone', 85, true, 2 WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Sandton & Rosebank');
INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order) SELECT 'Soweto & South', 'Southern areas delivery zone', 75, true, 3 WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Soweto & South');
INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order) SELECT 'East Rand', 'Ekurhuleni delivery zone', 95, true, 4 WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'East Rand');
INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order) SELECT 'West Rand', 'Western areas delivery zone', 95, true, 5 WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'West Rand');
INSERT INTO delivery_zones (name, description, base_fee, is_active, sort_order) SELECT 'Pretoria & Tshwane', 'Tshwane delivery zone', 110, true, 6 WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Pretoria & Tshwane');
INSERT INTO delivery_status_history (delivery_id, status, note, changed_by) SELECT d.id, d.status, 'Initial delivery record', NULL FROM deliveries d WHERE NOT EXISTS (SELECT 1 FROM delivery_status_history h WHERE h.delivery_id = d.id);
CREATE INDEX IF NOT EXISTS idx_delivery_status_history_delivery_id ON delivery_status_history(delivery_id);
