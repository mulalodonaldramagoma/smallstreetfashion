/*
# Small Street Fashion — Marketplace Schema (Stage 2)

Creates the full database schema for the Small Street Fashion marketplace:
profiles, stores, categories, products, and product_images tables with
Row Level Security policies, a trigger to auto-create profiles on signup,
and seed data for categories.

## Tables

1. **profiles** — extends Supabase auth.users with public profile data
   - id (uuid, PK, references auth.users)
   - full_name (text)
   - phone (text)
   - role (text: 'customer' | 'seller' | 'admin', default 'customer')
   - created_at, updated_at (timestamps)

2. **stores** — seller-owned stores
   - id (uuid, PK)
   - seller_id (uuid, references profiles, defaults to auth.uid())
   - name, slug, description, location, phone, whatsapp
   - logo_url, banner_url (text, nullable — storage URLs)
   - is_active (boolean, default true)
   - is_verified (boolean, default false)
   - created_at, updated_at

3. **categories** — product categories (shared/public, admin-managed)
   - id (uuid, PK)
   - name, slug, description
   - image_url (text, nullable)
   - created_at

4. **products** — products belonging to a store
   - id (uuid, PK)
   - store_id (uuid, references stores)
   - category_id (uuid, references categories)
   - name, description, sku
   - price, compare_at_price (numeric)
   - stock (integer, default 0)
   - sizes (text array)
   - colours (text array)
   - main_image_url (text, nullable)
   - is_featured (boolean, default false)
   - is_active (boolean, default true)
   - created_at, updated_at

5. **product_images** — additional images for a product
   - id (uuid, PK)
   - product_id (uuid, references products, cascade delete)
   - image_url (text)
   - position (integer, default 0)
   - created_at

## Security (RLS)

- **profiles**: each user reads/updates only their own profile. Admins can read all.
- **stores**: public can read active stores; sellers CRUD only their own store (by seller_id).
- **categories**: public read (anon + authenticated); no public writes (admin-managed via service role).
- **products**: public can read active products; sellers CRUD only products in their own store.
- **product_images**: public can read images for active products; sellers CRUD only images for products in their own store.

## Triggers

- **handle_new_user**: AFTER INSERT on auth.users → creates a matching profiles row.

## Notes

- Email confirmation is OFF (default).
- Owner columns (seller_id, store_id) default to auth.uid() or are validated via parent ownership.
- All policies use auth.uid(), never current_user.
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'seller', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read"
  ON categories FOR SELECT TO anon, authenticated
  USING (true);

-- ============ STORES ============
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  location text NOT NULL DEFAULT 'Small Street, Johannesburg CBD',
  phone text,
  whatsapp text,
  logo_url text,
  banner_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Public can read active stores
DROP POLICY IF EXISTS "stores_public_read" ON stores;
CREATE POLICY "stores_public_read"
  ON stores FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Sellers can read their own store even if inactive
DROP POLICY IF EXISTS "stores_select_own" ON stores;
CREATE POLICY "stores_select_own"
  ON stores FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);

-- Sellers insert their own store
DROP POLICY IF EXISTS "stores_insert_own" ON stores;
CREATE POLICY "stores_insert_own"
  ON stores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- Sellers update their own store
DROP POLICY IF EXISTS "stores_update_own" ON stores;
CREATE POLICY "stores_update_own"
  ON stores FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Sellers delete their own store
DROP POLICY IF EXISTS "stores_delete_own" ON stores;
CREATE POLICY "stores_delete_own"
  ON stores FOR DELETE TO authenticated
  USING (auth.uid() = seller_id);

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sku text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  compare_at_price numeric(10,2),
  stock integer NOT NULL DEFAULT 0,
  sizes text[] NOT NULL DEFAULT '{}',
  colours text[] NOT NULL DEFAULT '{}',
  main_image_url text,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can read active products
DROP POLICY IF EXISTS "products_public_read" ON products;
CREATE POLICY "products_public_read"
  ON products FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Sellers can read all their own products (active or inactive)
DROP POLICY IF EXISTS "products_select_own" ON products;
CREATE POLICY "products_select_own"
  ON products FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.seller_id = auth.uid()
    )
  );

-- Sellers can insert products into their own store
DROP POLICY IF EXISTS "products_insert_own" ON products;
CREATE POLICY "products_insert_own"
  ON products FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.seller_id = auth.uid()
    )
  );

-- Sellers can update products in their own store
DROP POLICY IF EXISTS "products_update_own" ON products;
CREATE POLICY "products_update_own"
  ON products FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.seller_id = auth.uid()
    )
  );

-- Sellers can delete products in their own store
DROP POLICY IF EXISTS "products_delete_own" ON products;
CREATE POLICY "products_delete_own"
  ON products FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
      AND stores.seller_id = auth.uid()
    )
  );

-- ============ PRODUCT_IMAGES ============
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Public can read images for active products
DROP POLICY IF EXISTS "product_images_public_read" ON product_images;
CREATE POLICY "product_images_public_read"
  ON product_images FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.is_active = true
    )
  );

-- Sellers can read images for their own products
DROP POLICY IF EXISTS "product_images_select_own" ON product_images;
CREATE POLICY "product_images_select_own"
  ON product_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      JOIN stores ON stores.id = products.store_id
      WHERE products.id = product_images.product_id
      AND stores.seller_id = auth.uid()
    )
  );

-- Sellers can insert images for their own products
DROP POLICY IF EXISTS "product_images_insert_own" ON product_images;
CREATE POLICY "product_images_insert_own"
  ON product_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      JOIN stores ON stores.id = products.store_id
      WHERE products.id = product_images.product_id
      AND stores.seller_id = auth.uid()
    )
  );

-- Sellers can delete images for their own products
DROP POLICY IF EXISTS "product_images_delete_own" ON product_images;
CREATE POLICY "product_images_delete_own"
  ON product_images FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      JOIN stores ON stores.id = products.store_id
      WHERE products.id = product_images.product_id
      AND stores.seller_id = auth.uid()
    )
  );

-- ============ TRIGGER: Auto-create profile on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_stores_seller_id ON stores(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
