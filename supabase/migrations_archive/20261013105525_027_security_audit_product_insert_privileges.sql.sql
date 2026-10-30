/*
# Security Audit: Revoke INSERT on product moderation columns

Sellers should not be able to set is_featured or is_demo when creating products.
These are admin/marketplace moderation flags.
*/

REVOKE INSERT ON public.products FROM authenticated, anon;
GRANT INSERT (
  store_id, category_id, name, description, sku, price, compare_at_price,
  stock, sizes, colours, main_image_url, is_active
) ON public.products TO authenticated;
