-- Seed 8 demo products for Meli's Collection (store_id = a1111111-...)
-- All products: is_active=false, is_demo=true, stock=0 (not invented), sku=NULL (not invented)
-- Prices from publicly advertised listings
-- Using DO $$ blocks with IF NOT EXISTS for idempotency (no unique constraint on product name)
-- Category: Women's Fashion = '14fa16eb-38b1-4221-87e5-599b62efd638'

DO $$
DECLARE
  v_store_id uuid := 'a1111111-1111-4111-8111-111111111111';
  v_women_cat uuid := '14fa16eb-38b1-4221-87e5-599b62efd638';
BEGIN
  -- 1. Printed Maxi Dress — R100
  IF NOT EXISTS (SELECT 1 FROM products WHERE store_id = v_store_id AND name = 'Printed Maxi Dress' AND price = 100) THEN
    INSERT INTO products (store_id, category_id, name, description, price, is_active, is_demo, main_image_url)
    VALUES (v_store_id, v_women_cat, 'Printed Maxi Dress',
      'Demo product — advertised price R100. Unverified. Not for sale until confirmed by an authorized seller.',
      100, false, true,
      'https://images.pexels.com/photos/936077/pexels-photo-936077.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');
  END IF;

  -- 2. Knit Top — R255
  IF NOT EXISTS (SELECT 1 FROM products WHERE store_id = v_store_id AND name = 'Knit Top' AND price = 255) THEN
    INSERT INTO products (store_id, category_id, name, description, price, is_active, is_demo, main_image_url)
    VALUES (v_store_id, v_women_cat, 'Knit Top',
      'Demo product — advertised price R255. Unverified. Not for sale until confirmed by an authorized seller.',
      255, false, true,
      'https://images.pexels.com/photos/39457498/pexels-photo-39457498.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');
  END IF;

  -- 3. Wrap-Style Satin Dress — R295
  IF NOT EXISTS (SELECT 1 FROM products WHERE store_id = v_store_id AND name = 'Wrap-Style Satin Dress' AND price = 295) THEN
    INSERT INTO products (store_id, category_id, name, description, price, is_active, is_demo, main_image_url)
    VALUES (v_store_id, v_women_cat, 'Wrap-Style Satin Dress',
      'Demo product — advertised price R295. Unverified. Not for sale until confirmed by an authorized seller.',
      295, false, true,
      'https://images.pexels.com/photos/19771924/pexels-photo-19771924.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');
  END IF;

  -- 4. Two-Piece Skirt and Blouse Set — R339
  IF NOT EXISTS (SELECT 1 FROM products WHERE store_id = v_store_id AND name = 'Two-Piece Skirt and Blouse Set' AND price = 339) THEN
    INSERT INTO products (store_id, category_id, name, description, price, is_active, is_demo, main_image_url)
    VALUES (v_store_id, v_women_cat, 'Two-Piece Skirt and Blouse Set',
      'Demo product — advertised price R339. Unverified. Not for sale until confirmed by an authorized seller.',
      339, false, true,
      'https://images.pexels.com/photos/9377975/pexels-photo-9377975.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');
  END IF;

  -- 5. Wide-Leg Track Pants — R265
  IF NOT EXISTS (SELECT 1 FROM products WHERE store_id = v_store_id AND name = 'Wide-Leg Track Pants' AND price = 265) THEN
    INSERT INTO products (store_id, category_id, name, description, price, is_active, is_demo, main_image_url)
    VALUES (v_store_id, v_women_cat, 'Wide-Leg Track Pants',
      'Demo product — advertised price R265. Unverified. Not for sale until confirmed by an authorized seller.',
      265, false, true,
      'https://images.pexels.com/photos/7202826/pexels-photo-7202826.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');
  END IF;

  -- 6. Wide-Leg Track Pants — R285 (second variant at different price)
  IF NOT EXISTS (SELECT 1 FROM products WHERE store_id = v_store_id AND name = 'Wide-Leg Track Pants' AND price = 285) THEN
    INSERT INTO products (store_id, category_id, name, description, price, is_active, is_demo, main_image_url)
    VALUES (v_store_id, v_women_cat, 'Wide-Leg Track Pants',
      'Demo product — advertised price R285. Unverified. Not for sale until confirmed by an authorized seller.',
      285, false, true,
      'https://images.pexels.com/photos/11294179/pexels-photo-11294179.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');
  END IF;

  -- 7. Sequin Evening Dress — R650
  IF NOT EXISTS (SELECT 1 FROM products WHERE store_id = v_store_id AND name = 'Sequin Evening Dress' AND price = 650) THEN
    INSERT INTO products (store_id, category_id, name, description, price, is_active, is_demo, main_image_url)
    VALUES (v_store_id, v_women_cat, 'Sequin Evening Dress',
      'Demo product — advertised price R650. Unverified. Not for sale until confirmed by an authorized seller.',
      650, false, true,
      'https://images.pexels.com/photos/16550502/pexels-photo-16550502.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');
  END IF;

  -- 8. Faux-Fur Coat — R330
  IF NOT EXISTS (SELECT 1 FROM products WHERE store_id = v_store_id AND name = 'Faux-Fur Coat' AND price = 330) THEN
    INSERT INTO products (store_id, category_id, name, description, price, is_active, is_demo, main_image_url)
    VALUES (v_store_id, v_women_cat, 'Faux-Fur Coat',
      'Demo product — advertised price R330. Unverified. Not for sale until confirmed by an authorized seller.',
      330, false, true,
      'https://images.pexels.com/photos/34189300/pexels-photo-34189300.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');
  END IF;
END $$;
