/*
# Map Existing Products to Subcategories

## What this does
Reassigns category_id on existing products from broad department-level categories
to specific subcategories, based on product names.

## Why it's needed
After creating the subcategory hierarchy, existing products still point to the
broad department categories (Women, Men, Shoes, Bags, Accessories, Tracksuits).
This migration moves them to the appropriate subcategories so filtering works.

## Mapping logic
Women's products:
- "Blue Satin Evening Gown" → Dresses & Jumpsuits
- "Elegant Yellow Maxi Dress" → Dresses & Jumpsuits
- "Floral Print Sundress" → Dresses & Jumpsuits
- "Red Cocktail Dress" → Dresses & Jumpsuits
- "Streetwear Graphic Tee" → Tops & T-shirts
- "High-Waist Mom Jeans" → Jeans & Denim
- "Streetwear Hoodie Dress" → Hoodies & Jackets

Men's products:
- "Urban Crew Neck Tee" → T-shirts & Tops
- "Denim Shirt" → Shirts
- "Slim Fit Straight Jeans" → Jeans & Denim
- "Oversized Cargo Pants" → Pants & Chinos
- "Kasi Graphic Hoodie" → Hoodies & Jackets
- "Classic Denim Jacket" → Hoodies & Jackets
- "Urban Bomber Jacket" → Hoodies & Jackets
- "Tech Fleece Joggers" → Pants & Chinos

Shoes:
- "Classic White Sneakers" → Sneakers & Trainers
- "Retro Red Sneakers" → Sneakers & Trainers
- "Canvas Slip-On Sneakers" → Sneakers & Trainers

Bags & Accessories:
- "Leather Tote Bag" → Handbags
- "Quilted Crossbody Bag" → Handbags
- "Snapback Cap" → Caps & Hats
- "Statement Hoop Earrings Set" → Jewellery

Tracksuits (old category → men's tracksuits subcategory):
- "Kasi Tracksuit Set" → Men's Tracksuits
- "Maroon Tracksuit Suit" → Men's Tracksuits

## Safety
- Uses product name matching to find the right subcategory slug.
- Only updates products that match by name — no blanket updates.
- The old "Tracksuits" category row is NOT deleted; it remains for referential
  integrity. Products are simply reassigned to the new subcategory.
*/

DO $$
DECLARE
  sub_cat_id uuid;
BEGIN
  -- Women: Dresses & Jumpsuits
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'women-dresses-jumpsuits';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'women')
  AND name IN ('Blue Satin Evening Gown', 'Elegant Yellow Maxi Dress', 'Floral Print Sundress', 'Red Cocktail Dress');

  -- Women: Tops & T-shirts
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'women-tops-tshirts';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'women')
  AND name = 'Streetwear Graphic Tee';

  -- Women: Jeans & Denim
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'women-jeans-denim';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'women')
  AND name = 'High-Waist Mom Jeans';

  -- Women: Hoodies & Jackets
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'women-hoodies-jackets';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'women')
  AND name = 'Streetwear Hoodie Dress';

  -- Men: T-shirts & Tops
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'men-tshirts-tops';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'men')
  AND name = 'Urban Crew Neck Tee';

  -- Men: Shirts
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'men-shirts';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'men')
  AND name = 'Denim Shirt';

  -- Men: Jeans & Denim
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'men-jeans-denim';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'men')
  AND name = 'Slim Fit Straight Jeans';

  -- Men: Pants & Chinos
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'men-pants-chinos';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'men')
  AND name IN ('Oversized Cargo Pants', 'Tech Fleece Joggers');

  -- Men: Hoodies & Jackets
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'men-hoodies-jackets';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'men')
  AND name IN ('Kasi Graphic Hoodie', 'Classic Denim Jacket', 'Urban Bomber Jacket');

  -- Shoes: Sneakers & Trainers
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'shoes-sneakers-trainers';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'shoes')
  AND name IN ('Classic White Sneakers', 'Retro Red Sneakers', 'Canvas Slip-On Sneakers');

  -- Bags & Accessories: Handbags
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'bags-handbags';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'bags')
  AND name IN ('Leather Tote Bag', 'Quilted Crossbody Bag');

  -- Bags & Accessories: Caps & Hats
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'bags-caps-hats';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'bags')
  AND name = 'Snapback Cap';

  -- Bags & Accessories: Jewellery
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'bags-jewellery';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'bags')
  AND name = 'Statement Hoop Earrings Set';

  -- Old Accessories department products → Bags & Accessories subcategories
  -- Snapback Cap already mapped above if it was in 'bags'. Check 'accessories' too:
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'bags-caps-hats';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'accessories')
  AND name = 'Snapback Cap';

  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'bags-jewellery';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'accessories')
  AND name = 'Statement Hoop Earrings Set';

  -- Old Tracksuits → Men's Tracksuits
  SELECT id INTO sub_cat_id FROM categories WHERE slug = 'men-tracksuits';
  UPDATE products SET category_id = sub_cat_id
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'tracksuits')
  AND name IN ('Kasi Tracksuit Set', 'Maroon Tracksuit Suit');

END $$;
