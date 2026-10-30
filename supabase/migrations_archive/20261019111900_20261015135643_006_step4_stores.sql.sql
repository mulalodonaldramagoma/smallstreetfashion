-- Seed 4 demo stores (unverified, inactive, is_demo=true, seller_id=NULL)
INSERT INTO stores (id, name, slug, description, location, is_active, is_verified, is_demo, seller_id, source_url, research_date)
VALUES
  ('a1111111-1111-4111-8111-111111111111', 'Meli''s Collection', 'melis-collection',
   'Fashion boutique in the Small Street Mall area offering printed maxi dresses, knit tops, satin dresses, two-piece sets, track pants, sequin evening wear and faux-fur coats. Unverified demo listing — not yet claimed by the shop owner.',
   '1559 Market Street, Small Street Mall, Johannesburg CBD', false, false, true, NULL, NULL, CURRENT_DATE),
  ('a2222222-2222-4222-8222-222222222222', 'Oliit Fashion', 'oliit-fashion',
   'Fashion shop on Pritchard Street in Johannesburg CBD. Unverified demo listing — not yet claimed by the shop owner.',
   '79 Pritchard Street, Johannesburg CBD', false, false, true, NULL, NULL, CURRENT_DATE),
  ('a3333333-3333-4333-8333-333333333333', 'Solyana Fashion', 'solyana-fashion',
   'Fashion shop on Small Street in Johannesburg CBD. Unverified demo listing — not yet claimed by the shop owner.',
   '100 Small Street, Johannesburg CBD', false, false, true, NULL, NULL, CURRENT_DATE),
  ('a4444444-4444-4444-8444-444444444444', 'Diva Noir', 'diva-noir',
   'Fashion shop on Market Street in Johannesburg CBD. Unverified demo listing — not yet claimed by the shop owner.',
   '101 Market Street, Johannesburg CBD', false, false, true, NULL, NULL, CURRENT_DATE)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  location = EXCLUDED.location,
  is_active = false,
  is_verified = false,
  is_demo = true,
  seller_id = NULL,
  source_url = EXCLUDED.source_url,
  research_date = EXCLUDED.research_date,
  updated_at = now();
