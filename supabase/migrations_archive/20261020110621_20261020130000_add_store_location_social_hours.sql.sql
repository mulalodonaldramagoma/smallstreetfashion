/*
# Add store location, social links, and opening hours fields

## Changes
Adds optional columns to the existing `stores` table for structured
address, Google Maps, social media, and opening hours. All columns are
nullable so existing stores are unaffected.

## New columns on `stores`
- address_line (text) — street address
- building_name (text) — building or shopping complex
- shop_number (text) — physical shop number
- area (text) — e.g. Small Street, Johannesburg CBD
- city (text)
- province (text)
- postal_code (text)
- google_maps_url (text) — seller-provided Google Maps place/share URL
- latitude (numeric(10,7)) — optional coordinate
- longitude (numeric(10,7)) — optional coordinate
- instagram_url (text)
- tiktok_url (text)
- facebook_url (text)
- website_url (text)
- opening_hours (jsonb) — weekly schedule structured as:
  [{ "day": 1, "is_closed": false, "periods": [{ "open": "09:00", "close": "17:00" }] }, ...]
  Days 1=Mon..7=Sun. Empty/null means not configured.

## Security
- No new policies needed — existing stores RLS covers these columns.
- Public read via stores_public_read (is_active = true) already exposes
  all columns. No private data is added (no payment/secrets).
- Seller and admin update policies already cover all columns on the table.
*/

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS building_name text,
  ADD COLUMN IF NOT EXISTS shop_number text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS opening_hours jsonb;
