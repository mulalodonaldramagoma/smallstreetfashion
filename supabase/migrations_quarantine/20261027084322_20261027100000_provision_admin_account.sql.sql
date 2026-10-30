-- Stage 7: Provision sole administrator account
-- ramagomamd@outlook.com (user id cb123b3f-d027-4aed-ae6f-6b1695bb5790)
--
-- This uses the established secure provisioning mechanism:
-- 1. Add to private.admin_allowlist (revoked_at NULL = active)
-- 2. Set profiles.role = 'admin' so the role field is consistent
--
-- The is_admin() function checks the allowlist, not profiles.role,
-- so the allowlist entry is the authoritative admin grant. The profiles
-- role update is for display consistency only.

INSERT INTO private.admin_allowlist (user_id, granted_by, revoked_at)
VALUES ('cb123b3f-d027-4aed-ae6f-6b1695bb5790', 'stage7_provision', NULL)
ON CONFLICT (user_id) DO UPDATE
  SET granted_at = now(),
      granted_by = EXCLUDED.granted_by,
      revoked_at = NULL;

UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE id = 'cb123b3f-d027-4aed-ae6f-6b1695bb5790';
