-- 1. Promote Ramagoma Mulalo Donald to admin via service role (bypasses trigger)
UPDATE public.profiles SET role = 'admin', updated_at = now() WHERE id = '16b140aa-380d-42a6-a943-8e1fd99cc582';

-- 2. Add Ramagoma Mulalo Donald to the admin allowlist
INSERT INTO private.admin_allowlist (user_id, granted_by)
VALUES ('16b140aa-380d-42a6-a943-8e1fd99cc582', 'migration_promotion')
ON CONFLICT (user_id) DO UPDATE SET granted_at = now(), granted_by = EXCLUDED.granted_by, revoked_at = NULL;

-- 3. Link Mulalo MD (fe793e60) to Meli's Collection and Solyana Fashion
UPDATE public.stores SET seller_id = 'fe793e60-39f2-41b5-9786-6caea8852f8f', is_active = true, is_verified = true, updated_at = now()
WHERE id IN ('a1111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333');

-- 4. Link Rudzani Thomas (b3a54129) to Oliit Fashion and Diva Noir
UPDATE public.stores SET seller_id = 'b3a54129-8f7c-4ce4-b434-1a7b2bacedb2', is_active = true, is_verified = true, updated_at = now()
WHERE id IN ('a2222222-2222-4222-8222-222222222222', 'a4444444-4444-4444-8444-444444444444');
