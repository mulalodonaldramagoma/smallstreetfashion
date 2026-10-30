/*
# Wishlist Items — Schema and RLS

## Purpose
Persists customer wishlists so saved products survive across sessions and devices
for signed-in users. Guests continue using localStorage (no DB row created).

## New Tables
- `wishlist_items`
  - `id` (uuid, PK, default gen_random_uuid)
  - `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), FK to auth.users CASCADE)
  - `product_id` (uuid, NOT NULL, FK to products CASCADE)
  - `created_at` (timestamptz, default now())
  - UNIQUE constraint on (user_id, product_id) prevents duplicate wishlist entries.

## Security (RLS)
- RLS enabled on `wishlist_items`.
- Four separate policies (SELECT, INSERT, DELETE) scoped to `authenticated`
  users who own the row (user_id = auth.uid()). No UPDATE needed — wishlist
  items are added or removed, never edited.
- No `anon` policies: wishlist persistence is for signed-in users only.
  Guests use localStorage and their items are synced to the DB on sign-in.

## Grants
- SELECT, INSERT, DELETE on wishlist_items TO authenticated.
- service_role gets full CRUD for admin tooling.

## Notes
- The UNIQUE(user_id, product_id) constraint means re-wishlisting a product
  after removing it is safe — the old row is gone before a new one can be inserted.
- On sign-in, the WishlistContext merges localStorage guest items into the DB
  and clears localStorage, so the user's wishlist follows them across devices.
*/

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wishlist_items_user_product_unique UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_user ON public.wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product ON public.wishlist_items(product_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.wishlist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO service_role;

DROP POLICY IF EXISTS "select_own_wishlist" ON public.wishlist_items;
CREATE POLICY "select_own_wishlist"
ON public.wishlist_items FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wishlist" ON public.wishlist_items;
CREATE POLICY "insert_own_wishlist"
ON public.wishlist_items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wishlist" ON public.wishlist_items;
CREATE POLICY "delete_own_wishlist"
ON public.wishlist_items FOR DELETE
TO authenticated
USING (auth.uid() = user_id);