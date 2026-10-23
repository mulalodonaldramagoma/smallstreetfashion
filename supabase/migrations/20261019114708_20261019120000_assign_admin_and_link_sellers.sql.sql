-- Promote ramagomamd@outlook.com to sole admin
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE id = '15dc3ab7-4bb3-4a5b-ae10-fc937b0a5e79';

-- Demote any other admins back to seller (ensures sole admin)
UPDATE public.profiles
SET role = 'seller', updated_at = now()
WHERE id <> '15dc3ab7-4bb3-4a5b-ae10-fc937b0a5e79'
  AND role = 'admin';

-- Ensure the remaining four users are sellers
UPDATE public.profiles
SET role = 'seller', updated_at = now()
WHERE id IN (
  'ad4f09ed-d8f9-40e4-96b9-5c9c53d3cb99',
  '8c55db38-eb4c-4b53-aa93-f875ff69ac33',
  '59683889-6129-4c54-8bc4-62ac8e912585',
  'eee2b187-eda2-4664-b395-ddac9983bb61'
);

-- Link each seller to a distinct store
UPDATE public.stores SET seller_id = 'ad4f09ed-d8f9-40e4-96b9-5c9c53d3cb99', updated_at = now() WHERE id = 'a1111111-1111-4111-8111-111111111111'; -- Mukhethwa Sydney -> Meli's Collection
UPDATE public.stores SET seller_id = '8c55db38-eb4c-4b53-aa93-f875ff69ac33', updated_at = now() WHERE id = 'a2222222-2222-4222-8222-222222222222'; -- Aluwani Ramagoma -> Oliit Fashion
UPDATE public.stores SET seller_id = '59683889-6129-4c54-8bc4-62ac8e912585', updated_at = now() WHERE id = 'a3333333-3333-4333-8333-333333333333'; -- Ramagoma Rudzani -> Solyana Fashion
UPDATE public.stores SET seller_id = 'eee2b187-eda2-4664-b395-ddac9983bb61', updated_at = now() WHERE id = 'a4444444-4444-4444-8444-444444444444'; -- Mulalo Donald -> Diva Noir
