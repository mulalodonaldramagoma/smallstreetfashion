/*
# Add foreign keys from review tables to profiles

## Problem
The review tables (`store_reviews`, `product_reviews`, `review_replies`) have
`user_id`/`seller_id` columns with FK constraints pointing to `auth.users(id)`,
but NOT to `profiles(id)`. The frontend review components use Supabase nested
joins like `reviewer_profile:profiles!store_reviews_user_id_fkey(id, full_name)`
to load the reviewer's display name alongside each review.

PostgREST resolves nested joins by following FK relationships. Since the FK
`store_reviews_user_id_fkey` targets `auth.users` (not `profiles`), PostgREST
cannot find a relationship from `store_reviews` to `profiles` through that
constraint name, and the query fails with a "Could not find a relationship"
error. This is why the store page shows "Unable to load store reviews."

The same issue affects:
- `product_reviews` → `profiles` (via `product_reviews_user_id_fkey`)
- `review_replies` → `profiles` (via `review_replies_seller_id_fkey`)

## Fix
Add complementary FK constraints from these tables to `profiles(id)`:
- `store_reviews_user_id_profiles_fkey`: `store_reviews.user_id` → `profiles.id`
- `product_reviews_user_id_profiles_fkey`: `product_reviews.user_id` → `profiles.id`
- `review_replies_seller_id_profiles_fkey`: `review_replies.seller_id` → `profiles.id`

These are additive — they do NOT replace the existing `auth.users` FKs. Both
FKs reference the same UUID value (since `profiles.id` has its own FK to
`auth.users.id`), so no data changes are needed.

This gives PostgREST a path to resolve the `profiles` join while preserving
the existing `auth.users` referential integrity.

## Security
- No RLS policies are changed.
- No new grants are added.
- The existing `profiles` RLS policies still apply to the nested join —
  a public visitor will get `null` for `reviewer_profile` (since they can't
  read other users' profiles), and the UI falls back to "Verified Customer".
  The review data itself loads correctly because `read_published_store_reviews`
  and `read_published_product_reviews` allow public access to published reviews.
- No service-role keys are used in frontend code.

## What is NOT changed
- Existing FK constraints to `auth.users` are preserved.
- RLS policies on review tables, profiles, and all other tables are unchanged.
- No payment, refund, earnings, reconciliation, inventory, or delivery logic.
- No review data is created, modified, or deleted.
*/

-- Add FK from store_reviews.user_id to profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_reviews_user_id_profiles_fkey'
    AND conrelid = 'store_reviews'::regclass
  ) THEN
    ALTER TABLE store_reviews
      ADD CONSTRAINT store_reviews_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK from product_reviews.user_id to profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_reviews_user_id_profiles_fkey'
    AND conrelid = 'product_reviews'::regclass
  ) THEN
    ALTER TABLE product_reviews
      ADD CONSTRAINT product_reviews_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK from review_replies.seller_id to profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'review_replies_seller_id_profiles_fkey'
    AND conrelid = 'review_replies'::regclass
  ) THEN
    ALTER TABLE review_replies
      ADD CONSTRAINT review_replies_seller_id_profiles_fkey
      FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
