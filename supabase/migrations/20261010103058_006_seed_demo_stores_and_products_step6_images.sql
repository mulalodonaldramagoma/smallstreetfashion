-- Seed product_images for each demo product (one image per product, matching main_image_url)
-- Idempotent: only insert if no product_images row exists for that product

INSERT INTO product_images (product_id, image_url, position)
SELECT p.id, p.main_image_url, 0
FROM products p
WHERE p.store_id = 'a1111111-1111-4111-8111-111111111111'
  AND p.is_demo = true
  AND p.main_image_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
  );
