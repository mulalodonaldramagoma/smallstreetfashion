/*
# Add Admin SELECT Policies on Stores and Products

## Overview
The admin dashboard needs to see ALL stores and products — including inactive
and unverified stores, and hidden/inactive products. The existing RLS policies
only allow public reads of active records and seller reads of their own records.
Admins were effectively blind to anything inactive.

## Security Changes

1. **stores_admin_select** — admins can SELECT all stores regardless of
   is_active status. The admin check uses an EXISTS subquery on profiles
   matching auth.uid() with role = 'admin'.

2. **products_admin_select** — admins can SELECT all products regardless of
   is_active status. Same admin-check pattern.

These are additive policies — they coexist with the existing public and
owner-scoped policies. RLS policies are OR-combined, so a row is visible if
ANY permissive policy passes.

## Notes
- The admin check pattern `EXISTS (SELECT 1 FROM profiles WHERE profiles.id =
  auth.uid() AND profiles.role = 'admin')` is the same pattern used in
  migration 014 for other admin policies.
- No existing policies are dropped or modified.
*/

-- Admin can read ALL stores (including inactive/unverified)
DROP POLICY IF EXISTS "stores_admin_select" ON stores;
CREATE POLICY "stores_admin_select"
  ON stores FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin can read ALL products (including inactive/hidden)
DROP POLICY IF EXISTS "products_admin_select" ON products;
CREATE POLICY "products_admin_select"
  ON products FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
