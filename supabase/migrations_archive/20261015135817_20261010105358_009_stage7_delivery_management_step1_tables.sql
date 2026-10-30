-- Stage 7 Step 1: Create delivery_methods and deliveries tables
CREATE TABLE IF NOT EXISTS delivery_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  fee numeric NOT NULL DEFAULT 0,
  estimated_days text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_method_id') THEN
    ALTER TABLE orders ADD COLUMN delivery_method_id uuid REFERENCES delivery_methods(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_method_id uuid REFERENCES delivery_methods(id),
  delivery_fee numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  tracking_note text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
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
  USING (EXISTS (SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN stores s ON s.id = oi.store_id WHERE o.id = deliveries.order_id AND s.seller_id = auth.uid()));

DROP POLICY IF EXISTS "deliveries_select_admin" ON deliveries;
CREATE POLICY "deliveries_select_admin"
  ON deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "deliveries_update_seller" ON deliveries;
CREATE POLICY "deliveries_update_seller"
  ON deliveries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN stores s ON s.id = oi.store_id WHERE o.id = deliveries.order_id AND s.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN stores s ON s.id = oi.store_id WHERE o.id = deliveries.order_id AND s.seller_id = auth.uid()));

DROP POLICY IF EXISTS "deliveries_update_admin" ON deliveries;
CREATE POLICY "deliveries_update_admin"
  ON deliveries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "deliveries_delete_admin" ON deliveries;
CREATE POLICY "deliveries_delete_admin"
  ON deliveries FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE OR REPLACE FUNCTION update_deliveries_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS deliveries_updated_at ON deliveries;
CREATE TRIGGER deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_deliveries_updated_at();

CREATE OR REPLACE FUNCTION update_delivery_methods_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS delivery_methods_updated_at ON delivery_methods;
CREATE TRIGGER delivery_methods_updated_at BEFORE UPDATE ON delivery_methods FOR EACH ROW EXECUTE FUNCTION update_delivery_methods_updated_at();

INSERT INTO delivery_methods (name, description, fee, estimated_days, is_active, sort_order)
SELECT 'Standard Delivery', 'Delivered within 3-5 business days', 65, '3-5 business days', true, 1
WHERE NOT EXISTS (SELECT 1 FROM delivery_methods);

INSERT INTO delivery_methods (name, description, fee, estimated_days, is_active, sort_order)
SELECT 'Express Delivery', 'Delivered within 1-2 business days', 120, '1-2 business days', true, 2
WHERE NOT EXISTS (SELECT 1 FROM delivery_methods WHERE name = 'Express Delivery');

INSERT INTO delivery_methods (name, description, fee, estimated_days, is_active, sort_order)
SELECT 'Store Pickup', 'Collect your order from the store', 0, 'Ready within 24 hours', true, 3
WHERE NOT EXISTS (SELECT 1 FROM delivery_methods WHERE name = 'Store Pickup');

INSERT INTO deliveries (order_id, delivery_fee, status, tracking_note)
SELECT o.id, o.delivery_fee, 'pending', 'Delivery record created from existing order'
FROM orders o
WHERE o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.order_id = o.id);
