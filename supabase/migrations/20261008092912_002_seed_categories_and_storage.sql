/*
# Seed Categories and Storage Setup

1. Seeds the categories table with the 6 marketplace categories:
   Women's Fashion, Men's Fashion, Shoes, Bags, Accessories, Tracksuits

2. Creates the product-images storage bucket for seller image uploads.
   Sets public read access so product images are visible to customers.
   Sellers can upload to their own folder.

## Notes
- Categories are referenced by products via category_id.
- The product-images bucket is public for read, authenticated for write.
*/

INSERT INTO categories (name, slug, description, image_url)
VALUES
  (
    'Women''s Fashion', 'women',
    'Dresses, tops, sets and more',
    'https://images.pexels.com/photos/892274/pexels-photo-892274.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
  ),
  (
    'Men''s Fashion', 'men',
    'Shirts, jeans, tracksuits and more',
    'https://images.pexels.com/photos/5607322/pexels-photo-5607322.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
  ),
  (
    'Shoes', 'shoes',
    'Sneakers, boots and heels',
    'https://images.pexels.com/photos/27516985/pexels-photo-27516985.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
  ),
  (
    'Bags', 'bags',
    'Handbags, crossbody bags and more',
    'https://images.pexels.com/photos/27174573/pexels-photo-27174573.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
  ),
  (
    'Accessories', 'accessories',
    'Sunglasses, jewellery and more',
    'https://images.pexels.com/photos/10237074/pexels-photo-10237074.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
  ),
  (
    'Tracksuits', 'tracksuits',
    'Street tracksuits and athleisure',
    'https://images.pexels.com/photos/13897451/pexels-photo-13897451.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
  )
ON CONFLICT (slug) DO NOTHING;

-- Create the product-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for product images
DROP POLICY IF EXISTS "product_images_bucket_public_read" ON storage.objects;
CREATE POLICY "product_images_bucket_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Authenticated sellers can upload to product-images bucket
DROP POLICY IF EXISTS "product_images_bucket_upload" ON storage.objects;
CREATE POLICY "product_images_bucket_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Sellers can update/delete their own uploads
DROP POLICY IF EXISTS "product_images_bucket_update" ON storage.objects;
CREATE POLICY "product_images_bucket_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid());

DROP POLICY IF EXISTS "product_images_bucket_delete" ON storage.objects;
CREATE POLICY "product_images_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid());
