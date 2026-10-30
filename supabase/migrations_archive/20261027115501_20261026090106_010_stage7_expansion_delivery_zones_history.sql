/*
# Stage 7 Expansion: Full Delivery Management

## Purpose
Expand the delivery system with:
1. Extended delivery statuses (9 states including failed and cancelled)
2. Delivery zones for Johannesburg CBD configurable by admin
3. Delivery status history table tracking every status change with timestamp and user
4. Delivery method types (pickup vs delivery) — pickup skips address at checkout
5. Order items shown to sellers in dispatch dashboard
*/

-- 1. Add type column to delivery_methods (defaults to 'delivery')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_methods' AND column_name = 'type'
  ) THEN
    ALTER TABLE delivery_methods ADD COLUMN type text NOT NULL DEFAULT 'delivery';
    -- Add check constraint for valid types
    ALTER TABLE delivery_methods ADD CONSTRAINT delivery_methods_type_check
      CHECK (type IN ('delivery', 'pickup'));
  END IF;
END $$;

-- 2. Create delivery_zones table
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

-- delivery_zones: public read
DROP POLICY IF EXISTS "delivery_zones_public_read" ON delivery_zones;
CREATE POLICY "delivery_zones_public_read"
  ON delivery_zones FOR SELECT
  TO anon, authenticated
  USING (true);

-- delivery_zones: admin-only write
DROP POLICY IF EXISTS "delivery_zones_admin_insert" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_insert"
  ON delivery_zones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "delivery_zones_admin_update" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_update"
  ON delivery_zones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "delivery_zones_admin_delete" ON delivery_zones;
CREATE POLICY "delivery_zones_admin_delete"
  ON delivery_zones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

GRANT SELECT ON delivery_zones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON delivery_zones TO authenticated;

-- updated_at trigger for delivery_zones
CREATE OR REPLACE FUNCTION update_delivery_zones_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_zones_updated_at ON delivery_zones;
CREATE TRIGGER delivery_zones_updated_at
  BEFORE UPDATE ON delivery_zones
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_zones_updated_at();

-- 3. Add zone_id to delivery_methods (nullable FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_methods' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE delivery_methods ADD COLUMN zone_id uuid REFERENCES delivery_zones(id);
  END IF;
END $$;

-- 4. Add new columns to deliveries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN cancelled_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'failed_at'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN failed_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN zone_id uuid REFERENCES delivery_zones(id);
  END IF;
END $$;

-- 5. Create delivery_status_history table
CREATE TABLE IF NOT EXISTS delivery_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_status_history ENABLE ROW LEVEL SECURITY;

-- delivery_status_history: customer can read own (via order ownership)
DROP POLICY IF EXISTS "dsh_select_customer" ON delivery_status_history;
CREATE POLICY "dsh_select_customer"
  ON delivery_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      WHERE d.id = delivery_status_history.delivery_id AND o.user_id = auth.uid()
    )
  );

-- delivery_status_history: seller can read for their store's orders
DROP POLICY IF EXISTS "dsh_select_seller" ON delivery_status_history;
CREATE POLICY "dsh_select_seller"
  ON delivery_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN stores s ON s.id = oi.store_id
      WHERE d.id = delivery_status_history.delivery_id AND s.seller_id = auth.uid()
    )
  );

-- delivery_status_history: admin can read all
DROP POLICY IF EXISTS "dsh_select_admin" ON delivery_status_history;
CREATE POLICY "dsh_select_admin"
  ON delivery_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- delivery_status_history: authenticated can insert (seller/admin advancing status)
DROP POLICY IF EXISTS "dsh_insert_seller" ON delivery_status_history;
CREATE POLICY "dsh_insert_seller"
  ON delivery_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN stores s ON s.id = oi.store_id
      WHERE d.id = delivery_status_history.delivery_id AND s.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "dsh_insert_admin" ON delivery_status_history;
CREATE POLICY "dsh_insert_admin"
  ON delivery_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- delivery_status_history: admin can delete
DROP POLICY IF EXISTS "dsh_delete_admin" ON delivery_status_history;
CREATE POLICY "dsh_delete_admin"
  ON delivery_status_history FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

GRANT SELECT, INSERT ON delivery_status_history TO authenticated;
GRANT DELETE ON delivery_status_history TO authenticated;

-- 6. Update existing 'Store Pickup' method to type 'pickup'
UPDATE delivery_methods SET type = 'pickup' WHERE name = 'Store Pickup';

-- 7. Seed default Johannesburg CBD delivery zones
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

-- 8. Insert initial status history for existing deliveries
INSERT INTO delivery_status_history (delivery_id, status, note, changed_by)
SELECT d.id, d.status, 'Initial delivery record', NULL
FROM deliveries d
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_status_history h WHERE h.delivery_id = d.id
);

-- 9. Add index on delivery_id for status history queries
CREATE INDEX IF NOT EXISTS idx_delivery_status_history_delivery_id
  ON delivery_status_history(delivery_id);
