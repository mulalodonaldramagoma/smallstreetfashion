/*
# Seed Demo Stores and Products — Johannesburg CBD Research Leads

## Purpose
Seeds 4 real Johannesburg CBD small-street fashion shops as unverified demo/research leads,
with specific advertised products and prices for Meli's Collection. All demo data is
unpublished (is_active=false) and unverified (is_verified=false) so it never appears on the
public storefront until an authorized seller confirms and claims the store.

## Schema Changes

### stores table
- ADD `source_url` (text, nullable) — URL where the business listing was found
- ADD `research_date` (date, nullable) — date the research was conducted
- ADD `is_demo` (boolean, NOT NULL, default false) — flags demo/research-lead stores
- ALTER `seller_id` DROP NOT NULL — allows unclaimed demo stores to exist without a seller.
  RLS policies use `auth.uid() = seller_id`, which evaluates to false when seller_id is NULL,
  so nobody can edit these stores until a real seller claims them.

### products table
- ADD `is_demo` (boolean, NOT NULL, default false) — flags demo/research-lead products
- ADD `source_url` (text, nullable) — URL where the product/price was found

## Security Changes

### handle_new_user() trigger function
- Changed to ALWAYS set role='customer' on signup, ignoring user-supplied role metadata.
  This prevents self-assignment of privileged roles (seller/admin). Role upgrades must
  happen via a controlled process (SQL with service role key).

### New admin read policies
- `stores_admin_read` — admin-role users can SELECT all stores (including inactive/demo)
- `products_admin_read` — admin-role users can SELECT all products (including inactive/demo)
- `product_images_admin_read` — admin-role users can SELECT all product images

These are ADDITIONAL SELECT policies (OR'd with existing ones). They do not weaken existing
policies — regular users see exactly the same data as before. Admins can additionally see
demo/unpublished data for management purposes.

## Data Seeded

### 4 Demo Stores (all is_active=false, is_verified=false, is_demo=true, seller_id=NULL)
1. Meli's Collection — 1559 Market Street, Small Street Mall, Johannesburg CBD
2. Oliit Fashion — 79 Pritchard Street, Johannesburg CBD
3. Solyana Fashion — 100 Small Street, Johannesburg CBD
4. Diva Noir — 101 Market Street, Johannesburg CBD

### 8 Demo Products for Meli's Collection (all is_active=false, is_demo=true)
1. Printed Maxi Dress — R100
2. Knit Top — R255
3. Wrap-Style Satin Dress — R295
4. Two-Piece Skirt and Blouse Set — R339
5. Wide-Leg Track Pants — R265
6. Wide-Leg Track Pants — R285
7. Sequin Evening Dress — R650
8. Faux-Fur Coat — R330

### Product Images
- Each product gets one licensed Pexels stock photo as main_image_url and one product_images row.
- No social media images are hotlinked.

## Idempotency
- Stores: INSERT ... ON CONFLICT (slug) DO UPDATE
- Products: DO $$ blocks with IF NOT EXISTS checks (no unique constraint on name)
- Product images: INSERT ... WHERE NOT EXISTS
- Policies: DROP POLICY IF EXISTS before CREATE POLICY

## Important Notes
1. No fake auth users are created. Demo stores have seller_id=NULL until a real seller claims them.
2. No passwords are stored in SQL files.
3. Stock counts default to 0 (not invented). SKUs are NULL (not invented).
4. Store phone/whatsapp are NULL (contact details not invented).
5. Source URLs are left NULL — the user should update these with the actual research source URLs.
6. The profiles table has no email column — emails live in auth.users and are accessible via Supabase Auth.
*/
