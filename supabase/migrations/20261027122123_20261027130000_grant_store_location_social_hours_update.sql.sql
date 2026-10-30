-- Grant authenticated role column-level UPDATE on the 15 new store columns
-- added by migration 20261026190000 (address, social, hours).
-- Narrowly scoped: only these columns, only UPDATE, only authenticated.
-- Existing RLS ownership policies ensure sellers can only update their own stores.

GRANT UPDATE (
  address_line, building_name, shop_number, area, city, province,
  postal_code, google_maps_url, latitude, longitude,
  instagram_url, tiktok_url, facebook_url, website_url, opening_hours
) ON public.stores TO authenticated;