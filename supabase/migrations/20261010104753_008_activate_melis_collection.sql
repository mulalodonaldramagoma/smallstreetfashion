-- Activate Meli's Collection store and its products
-- Makes the store visible on the public storefront and products purchasable

-- 1. Activate and verify the store
UPDATE stores
SET is_active = true,
    is_verified = true,
    updated_at = now()
WHERE slug = 'melis-collection' AND seller_id IS NOT NULL;

-- 2. Activate all products and set reasonable stock levels
UPDATE products
SET is_active = true,
    stock = CASE
      WHEN stock = 0 THEN 20
      ELSE stock
    END,
    updated_at = now()
WHERE store_id = 'a1111111-1111-4111-8111-111111111111';
