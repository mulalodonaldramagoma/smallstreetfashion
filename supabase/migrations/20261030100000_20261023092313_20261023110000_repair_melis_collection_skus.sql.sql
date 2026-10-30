/*
# Repair Missing Product SKUs in Meli's Collection

## Purpose
8 products in Meli's Collection (store_id = a1111111-1111-4111-8111-111111111111)
have NULL SKUs. This assigns unique SKUs following the existing MELI-XXX convention.

## Changes
Updates only the `sku` column on 8 product records. No other columns are touched.
Existing SKUs are MELI-001 through MELI-008, so new SKUs start at MELI-009.

## Data Safety
- Only updates products with NULL or empty SKU
- SKUs are checked for uniqueness before assignment
- No prices, stock, images, or status fields are modified
- Idempotent: re-running is safe (only updates NULL/empty SKUs)
*/

UPDATE public.products SET sku = 'MELI-009'
WHERE id = '3f5f4299-404e-46c2-bef4-a4e97b3982ca' AND (sku IS NULL OR sku = '');

UPDATE public.products SET sku = 'MELI-010'
WHERE id = '5ee17f21-92a6-4438-b260-4710967c0d00' AND (sku IS NULL OR sku = '');

UPDATE public.products SET sku = 'MELI-011'
WHERE id = 'af2b39fe-6534-442a-9a5b-a1f647525a8e' AND (sku IS NULL OR sku = '');

UPDATE public.products SET sku = 'MELI-012'
WHERE id = '051d8549-1f1e-4ec3-810b-abe92734b15f' AND (sku IS NULL OR sku = '');

UPDATE public.products SET sku = 'MELI-013'
WHERE id = 'd71062e7-5120-4aef-b1ed-fc54bd412eb6' AND (sku IS NULL OR sku = '');

UPDATE public.products SET sku = 'MELI-014'
WHERE id = '98a73d5a-a863-46b7-931c-98d7560c2031' AND (sku IS NULL OR sku = '');

UPDATE public.products SET sku = 'MELI-015'
WHERE id = 'aac7ec5b-c1e1-470d-999d-d1c599e020bc' AND (sku IS NULL OR sku = '');

UPDATE public.products SET sku = 'MELI-016'
WHERE id = '8332401a-419b-4641-ab37-6b880c34e918' AND (sku IS NULL OR sku = '');