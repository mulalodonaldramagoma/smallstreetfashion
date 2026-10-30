/*
# Category Hierarchy: Departments and Subcategories

## What this does
Adds a parent_id column to the categories table so categories can be organized
into a two-level hierarchy: departments (top-level) and subcategories (children).

## Why it's needed
The current categories are flat (Women, Men, Shoes, Bags, Accessories, Tracksuits).
This migration adds a parent_id column for the department → subcategory structure
inspired by Ackermans SA, then inserts the subcategories under the existing
department rows. Existing products keep their current category_id — no product
data changes in this migration.

## Changes
1. Adds `parent_id` (nullable uuid, self-referencing FK) to categories.
2. Adds `sort_order` (int, default 0) for display ordering.
3. Adds index on parent_id.
4. Renames "Women's Fashion" → "Women", "Men's Fashion" → "Men", "Bags" → "Bags & Accessories".
5. Inserts subcategory rows under each department.
6. Creates "Kids & Baby" department (no products yet — UI hides empty departments).

## Security
- No new tables. Categories already has RLS with anon+authenticated SELECT.
- No policy or grant changes needed.

## Important notes
- Idempotent: uses IF NOT EXISTS and ON CONFLICT.
- Existing products are NOT modified.
*/

-- 1. Add parent_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN parent_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Add sort_order column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE categories ADD COLUMN sort_order int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 3. Index on parent_id
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories(parent_id);

-- 4. Rename existing departments
UPDATE categories SET name = 'Women' WHERE slug = 'women' AND name = 'Women''s Fashion';
UPDATE categories SET name = 'Men' WHERE slug = 'men' AND name = 'Men''s Fashion';
UPDATE categories SET name = 'Bags & Accessories' WHERE slug = 'bags' AND name = 'Bags';

-- 5. Set sort order on existing top-level departments
UPDATE categories SET sort_order = 1 WHERE slug = 'women';
UPDATE categories SET sort_order = 2 WHERE slug = 'men';
UPDATE categories SET sort_order = 3 WHERE slug = 'shoes';
UPDATE categories SET sort_order = 4 WHERE slug = 'bags';
UPDATE categories SET sort_order = 5 WHERE slug = 'accessories';
UPDATE categories SET sort_order = 99 WHERE slug = 'tracksuits';

-- 6. Insert Kids & Baby department
INSERT INTO categories (name, slug, sort_order, parent_id)
VALUES ('Kids & Baby', 'kids-baby', 6, NULL)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- 7. Insert subcategories
DO $$
DECLARE
  v_women_id uuid;
  v_men_id uuid;
  v_shoes_id uuid;
  v_bags_id uuid;
  v_kids_id uuid;
BEGIN
  SELECT id INTO v_women_id FROM categories WHERE slug = 'women';
  SELECT id INTO v_men_id FROM categories WHERE slug = 'men';
  SELECT id INTO v_shoes_id FROM categories WHERE slug = 'shoes';
  SELECT id INTO v_bags_id FROM categories WHERE slug = 'bags';
  SELECT id INTO v_kids_id FROM categories WHERE slug = 'kids-baby';

  -- Women
  INSERT INTO categories (name, slug, parent_id, sort_order)
  VALUES
    ('Tops & T-shirts', 'women-tops-tshirts', v_women_id, 1),
    ('Shirts & Blouses', 'women-shirts-blouses', v_women_id, 2),
    ('Dresses & Jumpsuits', 'women-dresses-jumpsuits', v_women_id, 3),
    ('Jeans & Denim', 'women-jeans-denim', v_women_id, 4),
    ('Pants & Leggings', 'women-pants-leggings', v_women_id, 5),
    ('Shorts & Skirts', 'women-shorts-skirts', v_women_id, 6),
    ('Tracksuits & Matching Sets', 'women-tracksuits-sets', v_women_id, 7),
    ('Hoodies & Jackets', 'women-hoodies-jackets', v_women_id, 8),
    ('Knitwear', 'women-knitwear', v_women_id, 9),
    ('Sneakers & Trainers', 'women-sneakers-trainers', v_women_id, 10),
    ('Heels, Flats & Sandals', 'women-heels-flats-sandals', v_women_id, 11),
    ('Bags', 'women-bags', v_women_id, 12),
    ('Accessories', 'women-accessories', v_women_id, 13)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

  -- Men
  INSERT INTO categories (name, slug, parent_id, sort_order)
  VALUES
    ('T-shirts & Tops', 'men-tshirts-tops', v_men_id, 1),
    ('Shirts', 'men-shirts', v_men_id, 2),
    ('Jeans & Denim', 'men-jeans-denim', v_men_id, 3),
    ('Pants & Chinos', 'men-pants-chinos', v_men_id, 4),
    ('Shorts', 'men-shorts', v_men_id, 5),
    ('Tracksuits', 'men-tracksuits', v_men_id, 6),
    ('Hoodies & Jackets', 'men-hoodies-jackets', v_men_id, 7),
    ('Sneakers & Trainers', 'men-sneakers-trainers', v_men_id, 8),
    ('Formal Shoes', 'men-formal-shoes', v_men_id, 9),
    ('Sandals & Slippers', 'men-sandals-slippers', v_men_id, 10),
    ('Bags & Accessories', 'men-bags-accessories', v_men_id, 11)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

  -- Shoes
  INSERT INTO categories (name, slug, parent_id, sort_order)
  VALUES
    ('Men''s Shoes', 'shoes-men', v_shoes_id, 1),
    ('Women''s Shoes', 'shoes-women', v_shoes_id, 2),
    ('Sneakers & Trainers', 'shoes-sneakers-trainers', v_shoes_id, 3),
    ('Formal Shoes', 'shoes-formal', v_shoes_id, 4),
    ('Sandals & Slippers', 'shoes-sandals-slippers', v_shoes_id, 5)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

  -- Bags & Accessories
  INSERT INTO categories (name, slug, parent_id, sort_order)
  VALUES
    ('Handbags', 'bags-handbags', v_bags_id, 1),
    ('Backpacks & Bags', 'bags-backpacks', v_bags_id, 2),
    ('Caps & Hats', 'bags-caps-hats', v_bags_id, 3),
    ('Belts', 'bags-belts', v_bags_id, 4),
    ('Jewellery', 'bags-jewellery', v_bags_id, 5),
    ('Other Accessories', 'bags-other-accessories', v_bags_id, 6)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

  -- Kids & Baby
  INSERT INTO categories (name, slug, parent_id, sort_order)
  VALUES
    ('Boys'' Clothing', 'kids-boys', v_kids_id, 1),
    ('Girls'' Clothing', 'kids-girls', v_kids_id, 2),
    ('Baby Clothing', 'kids-baby-clothing', v_kids_id, 3),
    ('Kids'' Shoes', 'kids-shoes', v_kids_id, 4),
    ('Schoolwear', 'kids-schoolwear', v_kids_id, 5)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;
END $$;
