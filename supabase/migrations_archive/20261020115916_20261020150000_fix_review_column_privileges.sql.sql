/*
# Fix column privileges on review tables

The previous migration attempted to REVOKE UPDATE on privileged columns but
Postgres column-level REVOKE doesn't override table-level grants when the
column privilege was inherited. This migration explicitly grants UPDATE only
on the columns customers are allowed to modify (rating, body, updated_at)
and ensures status, is_verified_purchase, order_item_id, product_id, user_id,
store_id, order_id, seller_id, store_review_id cannot be updated by clients.
*/

-- Product reviews: only allow UPDATE on rating, body, updated_at
REVOKE UPDATE ON public.product_reviews FROM authenticated;
GRANT UPDATE (rating, body, updated_at) ON public.product_reviews TO authenticated;

-- Store reviews: only allow UPDATE on rating, body, updated_at
REVOKE UPDATE ON public.store_reviews FROM authenticated;
GRANT UPDATE (rating, body, updated_at) ON public.store_reviews TO authenticated;

-- Review replies: only allow UPDATE on body, updated_at
REVOKE UPDATE ON public.review_replies FROM authenticated;
GRANT UPDATE (body, updated_at) ON public.review_replies TO authenticated;
