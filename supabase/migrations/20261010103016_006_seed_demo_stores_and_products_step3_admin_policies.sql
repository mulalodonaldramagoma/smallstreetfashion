-- Add admin read policies (OR'd with existing SELECT policies)
-- These do NOT weaken existing policies; they ADD access for admin-role users only

-- stores: admin can see all stores including inactive/demo
DROP POLICY IF EXISTS "stores_admin_read" ON stores;
CREATE POLICY "stores_admin_read"
  ON stores FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- products: admin can see all products including inactive/demo
DROP POLICY IF EXISTS "products_admin_read" ON products;
CREATE POLICY "products_admin_read"
  ON products FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- product_images: admin can see all product images (including for inactive products)
DROP POLICY IF EXISTS "product_images_admin_read" ON product_images;
CREATE POLICY "product_images_admin_read"
  ON product_images FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));
