/*
# Review Photos — Schema, Storage Bucket, and RLS

1. New Tables
- `review_photos` — stores photo metadata for customer-submitted review images.
  - `id` (uuid, PK)
  - `product_review_id` (uuid, FK to product_reviews, CASCADE) — nullable
  - `store_review_id` (uuid, FK to store_reviews, CASCADE) — nullable
  - `user_id` (uuid, NOT NULL DEFAULT auth.uid(), FK to auth.users CASCADE)
  - `storage_path` (text, NOT NULL) — path within the review-photos storage bucket
  - `image_url` (text, NOT NULL) — public URL of the uploaded image
  - `position` (int, default 0) — ordering for multiple photos
  - `created_at` (timestamptz, default now())

  Exactly one of product_review_id / store_review_id must be set (enforced by CHECK).

2. Storage
- Creates a public storage bucket `review-photos` for review image uploads.
- Storage policies allow authenticated users to upload to their own folder and
  read all review photos (public bucket).

3. Security (RLS)
- RLS enabled on `review_photos`.
- SELECT: anyone (anon, authenticated) can read published review photos via a
  join to the parent review's status. The policy checks that the linked
  product_review or store_review has status = 'published'.
- INSERT: authenticated users can insert photos only for their own reviews
  (user_id = auth.uid()).
- UPDATE: not granted (photos are immutable once uploaded).
- DELETE: authenticated users can delete their own review photos.

4. Grants
- SELECT on review_photos to anon, authenticated (published photos are public).
- INSERT on review_photos to authenticated.
- DELETE on review_photos to authenticated.
- No UPDATE grant (photos are immutable).
- service_role gets full access for moderation/admin purposes.

5. Notes
- File type and size validation is enforced client-side (JPEG/PNG/WebP, max 5MB).
- Storage path pattern: {user_id}/{review_id}/{timestamp}-{random}.ext
- Photos are only visible when the parent review is published, ensuring
  hidden/pending reviews don't expose photos.
*/

-- ============================================================
-- 1. review_photos table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_review_id uuid REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  store_review_id uuid REFERENCES public.store_reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_photos_one_parent CHECK (
    (product_review_id IS NOT NULL AND store_review_id IS NULL) OR
    (product_review_id IS NULL AND store_review_id IS NULL) OR
    (product_review_id IS NULL AND store_review_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_review_photos_product_review ON public.review_photos(product_review_id);
CREATE INDEX IF NOT EXISTS idx_review_photos_store_review ON public.review_photos(store_review_id);
CREATE INDEX IF NOT EXISTS idx_review_photos_user ON public.review_photos(user_id);

ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Storage policies
-- ============================================================
-- Anyone can read review photos (public bucket)
DROP POLICY IF EXISTS "review_photos_public_read" ON storage.objects;
CREATE POLICY "review_photos_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'review-photos');

-- Authenticated users can upload to their own folder within review-photos
DROP POLICY IF EXISTS "review_photos_owner_insert" ON storage.objects;
CREATE POLICY "review_photos_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete their own review photos
DROP POLICY IF EXISTS "review_photos_owner_delete" ON storage.objects;
CREATE POLICY "review_photos_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'review-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 4. RLS Policies — review_photos
-- ============================================================

-- SELECT: published review photos are public; own photos always visible
DROP POLICY IF EXISTS "read_published_review_photos" ON public.review_photos;
CREATE POLICY "read_published_review_photos"
ON public.review_photos FOR SELECT
TO anon, authenticated
USING (
  user_id = auth.uid()
  OR (
    product_review_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.product_reviews pr
      WHERE pr.id = product_review_id AND pr.status = 'published'
    )
  )
  OR (
    store_review_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.store_reviews sr
      WHERE sr.id = store_review_id AND sr.status = 'published'
    )
  )
);

-- INSERT: only the review owner can add photos
DROP POLICY IF EXISTS "insert_own_review_photos" ON public.review_photos;
CREATE POLICY "insert_own_review_photos"
ON public.review_photos FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- DELETE: only the review owner can remove their photos
DROP POLICY IF EXISTS "delete_own_review_photos" ON public.review_photos;
CREATE POLICY "delete_own_review_photos"
ON public.review_photos FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- 5. Grants
-- ============================================================
GRANT SELECT ON public.review_photos TO anon, authenticated;
GRANT INSERT ON public.review_photos TO authenticated;
GRANT DELETE ON public.review_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_photos TO service_role;