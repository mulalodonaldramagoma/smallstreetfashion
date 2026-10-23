-- Activate Meli's Collection store and its products so they appear on the public storefront
-- (In the original flow, this happened after a seller claimed the store. We activate directly
--  since we don't have the original seller account in this database.)

-- 1. Activate and verify the store
UPDATE stores
SET is_active = true,
    is_verified = true,
    updated_at = now()
WHERE slug = 'melis-collection';

-- 2. Activate all products and set reasonable stock levels
UPDATE products
SET is_active = true,
    stock = CASE WHEN stock = 0 THEN 20 ELSE stock END,
    updated_at = now()
WHERE store_id = 'a1111111-1111-4111-8111-111111111111';

-- 3. Also activate the other 3 demo stores so the marketplace has multiple shops
UPDATE stores
SET is_active = true,
    is_verified = true,
    updated_at = now()
WHERE slug IN ('oliit-fashion', 'solyana-fashion', 'diva-noir');
