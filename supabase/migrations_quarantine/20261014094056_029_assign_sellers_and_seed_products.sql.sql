/*
# Stage 10: Assign sellers to stores, activate stores, and seed products

Assigns:
- Mukhethwa Sydney (d1a76421...) → Meli's Collection (a1111111...)
- Matibe Donald (73243494...) → Solyana Fashion (a3333333...)

Activates both stores (is_active = true, is_verified = true).
Creates products for each store using Pexels stock photos.
*/

-- Assign sellers to stores and activate
UPDATE public.stores
SET
  seller_id = 'd1a76421-5101-4a7e-b763-6dfd561fecfd',
  is_active = true,
  is_verified = true,
  is_demo = false,
  phone = '0797583843',
  whatsapp = '0797583843',
  updated_at = now()
WHERE id = 'a1111111-1111-4111-8111-111111111111';

UPDATE public.stores
SET
  seller_id = '73243494-4ab0-42da-baac-42f07ef0ba03',
  is_active = true,
  is_verified = true,
  is_demo = false,
  phone = '0825996279',
  whatsapp = '0825996279',
  updated_at = now()
WHERE id = 'a3333333-3333-4333-8333-333333333333';

-- Products for Meli's Collection (Women's Fashion focus)
INSERT INTO public.products (store_id, category_id, name, description, sku, price, compare_at_price, stock, sizes, colours, main_image_url, is_featured, is_active, is_demo)
VALUES
  (
    'a1111111-1111-4111-8111-111111111111',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Floral Print Maxi Dress',
    'Elegant floral print maxi dress perfect for special occasions. Features a flowing silhouette and comfortable fit. A Small Street Mall favourite.',
    'MELI-001',
    349.00,
    499.00,
    18,
    ARRAY['XS', 'S', 'M', 'L', 'XL'],
    ARRAY['Floral Pink', 'Floral Blue', 'Black'],
    'https://images.pexels.com/photos/18593350/pexels-photo-18593350.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    true,
    true,
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111111',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Knit Top with Shoulder Cutouts',
    'Trendy knit top with stylish shoulder cutouts. Lightweight and breathable, ideal for Johannesburg summers.',
    'MELI-002',
    189.00,
    249.00,
    25,
    ARRAY['S', 'M', 'L'],
    ARRAY['Cream', 'Black', 'Olive'],
    'https://images.pexels.com/photos/11311403/pexels-photo-11311403.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    true,
    true,
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111111',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Satin Wrap Dress',
    'Luxurious satin wrap dress that drapes beautifully. Perfect for evening events and dinner dates.',
    'MELI-003',
    429.00,
    null,
    12,
    ARRAY['XS', 'S', 'M', 'L'],
    ARRAY['Burgundy', 'Emerald', 'Black'],
    'https://images.pexels.com/photos/18250201/pexels-photo-18250201.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    false,
    true,
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111111',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Two-Piece Print Set',
    'Matching two-piece set with bold African-inspired prints. Includes crop top and wide-leg trousers.',
    'MELI-004',
    549.00,
    699.00,
    8,
    ARRAY['S', 'M', 'L', 'XL'],
    ARRAY['Multi Print', 'Earth Tones'],
    'https://images.pexels.com/photos/34777778/pexels-photo-34777778.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    true,
    true,
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111111',
    '811ec085-1da4-491a-bcad-373103a3246c',
    'Classic Tracksuit Set',
    'Comfortable tracksuit set for casual wear. Soft cotton blend with elastic waistband and matching jacket.',
    'MELI-005',
    399.00,
    null,
    20,
    ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    ARRAY['Grey', 'Navy', 'Black'],
    'https://images.pexels.com/photos/27208599/pexels-photo-27208599.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    false,
    true,
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111111',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Sequin Evening Gown',
    'Show-stopping sequin evening gown for special occasions. Catches the light with every movement.',
    'MELI-006',
    799.00,
    999.00,
    5,
    ARRAY['XS', 'S', 'M', 'L'],
    ARRAY['Gold', 'Silver', 'Rose Gold'],
    'https://images.pexels.com/photos/14452644/pexels-photo-14452644.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    true,
    true,
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111111',
    '93ae8486-d4b6-4c4f-bd94-d12cacbc26d1',
    'Strappy Heeled Sandals',
    'Elegant strappy heeled sandals to complement any outfit. Comfortable padded insole for all-day wear.',
    'MELI-007',
    299.00,
    null,
    15,
    ARRAY['36', '37', '38', '39', '40'],
    ARRAY['Black', 'Nude', 'Red'],
    'https://images.pexels.com/photos/31450745/pexels-photo-31450745.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    false,
    true,
    false
  ),
  (
    'a1111111-1111-4111-8111-111111111111',
    '115a2d66-63ca-4c95-8c06-6c6b7c314194',
    'Leather Handbag with Tassel',
    'Genuine leather handbag with decorative tassel. Spacious interior with multiple compartments.',
    'MELI-008',
    459.00,
    599.00,
    10,
    ARRAY['One Size'],
    ARRAY['Tan', 'Black', 'Brown'],
    'https://images.pexels.com/photos/31450723/pexels-photo-31450723.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    false,
    true,
    false
  );

-- Products for Solyana Fashion (mixed fashion)
INSERT INTO public.products (store_id, category_id, name, description, sku, price, compare_at_price, stock, sizes, colours, main_image_url, is_featured, is_active, is_demo)
VALUES
  (
    'a3333333-3333-4333-8333-333333333333',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Urban Denim Jacket',
    'Classic denim jacket with a modern cut. Versatile layering piece for any season.',
    'SOLY-001',
    379.00,
    449.00,
    22,
    ARRAY['XS', 'S', 'M', 'L', 'XL'],
    ARRAY['Light Blue', 'Dark Blue', 'Black'],
    'https://images.pexels.com/photos/19243417/pexels-photo-19243417.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    true,
    true,
    false
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Red Power Blazer',
    'Bold red blazer that makes a statement. Tailored fit with structured shoulders.',
    'SOLY-002',
    529.00,
    null,
    14,
    ARRAY['S', 'M', 'L', 'XL'],
    ARRAY['Red', 'Black'],
    'https://images.pexels.com/photos/4937443/pexels-photo-4937443.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    true,
    true,
    false
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Casual Denim & Top Combo',
    'Relaxed everyday outfit featuring denim jeans and a lightweight blue top. Perfect for weekend outings.',
    'SOLY-003',
    449.00,
    599.00,
    16,
    ARRAY['XS', 'S', 'M', 'L'],
    ARRAY['Blue', 'Light Blue'],
    'https://images.pexels.com/photos/28698875/pexels-photo-28698875.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    false,
    true,
    false
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Leather Pants & Beige Jacket',
    'Trendy faux-leather pants paired with a beige jacket. Edgy yet sophisticated street style.',
    'SOLY-004',
    619.00,
    null,
    7,
    ARRAY['S', 'M', 'L'],
    ARRAY['Black/Beige'],
    'https://images.pexels.com/photos/24839164/pexels-photo-24839164.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    true,
    true,
    false
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'd4ff25a7-2e38-49f3-bb29-191e6b90fcac',
    'Men''s Traditional Shirt',
    'Smart-casual men''s shirt inspired by traditional African patterns. Breathable cotton fabric.',
    'SOLY-005',
    289.00,
    349.00,
    30,
    ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    ARRAY['White', 'Earth', 'Navy'],
    'https://images.pexels.com/photos/38257648/pexels-photo-38257648.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    false,
    true,
    false
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    '115a2d66-63ca-4c95-8c06-6c6b7c314194',
    'Designer Tote Bag',
    'Spacious designer-inspired tote bag with premium finish. Perfect for work or shopping.',
    'SOLY-006',
    349.00,
    null,
    18,
    ARRAY['One Size'],
    ARRAY['Black', 'Brown', 'Cream'],
    'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    false,
    true,
    false
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    '93ae8486-d4b6-4c4f-bd94-d12cacbc26d1',
    'Ankle Boot Boots',
    'Stylish leather ankle boots with comfortable block heel. Versatile for day or night.',
    'SOLY-007',
    429.00,
    549.00,
    12,
    ARRAY['36', '37', '38', '39', '40', '41'],
    ARRAY['Brown', 'Black'],
    'https://images.pexels.com/photos/31450739/pexels-photo-31450739.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    true,
    true,
    false
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'd1ffc5fc-62d8-48bc-941c-2d08c3914ccc',
    'Black Urban Street Outfit',
    'Sleek all-black urban outfit with fitted silhouette. Modern street fashion at its best.',
    'SOLY-008',
    549.00,
    null,
    9,
    ARRAY['XS', 'S', 'M', 'L'],
    ARRAY['Black'],
    'https://images.pexels.com/photos/37036191/pexels-photo-37036191.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    false,
    true,
    false
  );
