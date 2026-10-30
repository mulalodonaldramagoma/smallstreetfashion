/*
# Saved Delivery Addresses

1. New Tables
- `saved_addresses` — stores reusable delivery addresses for each user.
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users ON DELETE CASCADE)
  - `label` (text, not null) — e.g. "Home", "Work", "Mom's place"
  - `recipient_name` (text, not null) — who will receive the delivery
  - `phone` (text, null) — contact phone for delivery
  - `delivery_address` (text, not null) — street address
  - `suburb` (text, not null)
  - `city` (text, not null)
  - `province` (text, not null)
  - `postal_code` (text, not null)
  - `delivery_instructions` (text, null) — optional notes for courier
  - `is_default` (boolean, default false) — marks the user's preferred address
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `saved_addresses`.
- Grant SELECT, INSERT, UPDATE, DELETE to `authenticated` only (this is a signed-in app).
- 4 owner-scoped policies (one per CRUD verb) using `auth.uid() = user_id`.
- `user_id` defaults to `auth.uid()` so inserts that omit it still satisfy the WITH CHECK.

3. Indexes
- `saved_addresses_user_id_idx` on `user_id` for fast per-user lookups.

4. Important Notes
- Only one address per user can be `is_default = true`. The application layer enforces this
  by clearing other defaults before setting a new one. No DB trigger is added to keep it simple.
- The table reuses the same address field names as `orders` for consistency.
*/

CREATE TABLE IF NOT EXISTS saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  recipient_name text NOT NULL,
  phone text,
  delivery_address text NOT NULL,
  suburb text NOT NULL,
  city text NOT NULL,
  province text NOT NULL,
  postal_code text NOT NULL,
  delivery_instructions text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON saved_addresses TO authenticated;

CREATE INDEX IF NOT EXISTS saved_addresses_user_id_idx ON saved_addresses(user_id);

DROP POLICY IF EXISTS "select_own_saved_addresses" ON saved_addresses;
CREATE POLICY "select_own_saved_addresses"
ON saved_addresses FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved_addresses" ON saved_addresses;
CREATE POLICY "insert_own_saved_addresses"
ON saved_addresses FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_saved_addresses" ON saved_addresses;
CREATE POLICY "update_own_saved_addresses"
ON saved_addresses FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved_addresses" ON saved_addresses;
CREATE POLICY "delete_own_saved_addresses"
ON saved_addresses FOR DELETE
TO authenticated USING (auth.uid() = user_id);
