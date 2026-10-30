-- Add foreign keys from review tables to profiles (Batch 5)
-- Allows PostgREST nested joins like reviewer_profile:profiles!store_reviews_user_id_fkey
-- to resolve. Additive — preserves existing auth.users FKs.

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'review_reports_reporter_id_profiles_fkey'
    AND conrelid = 'review_reports'::regclass
  ) THEN
    ALTER TABLE review_reports
      ADD CONSTRAINT review_reports_reporter_id_profiles_fkey
      FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;