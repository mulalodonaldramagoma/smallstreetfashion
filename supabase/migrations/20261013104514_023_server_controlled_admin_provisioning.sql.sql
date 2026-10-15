/*
# Server-Controlled Administrator Provisioning

## Overview
Adds a private administrator allowlist so access is granted by trusted
server-side provisioning rather than by changing an ordinary user's profile.
Existing administrators are copied into the allowlist once so the current
admin dashboard continues to work without changing user records.

## New Private Table
- `private.admin_allowlist`
- `user_id` — explicitly authorised account
- `granted_at` — provisioning timestamp
- `granted_by` — optional operator account or service identifier
- `revoked_at` — nullable revocation timestamp

## Security Changes
1. The allowlist is outside the public API schema and has RLS enabled.
2. `private.is_admin()` now checks only active allowlist entries.
3. `private.provision_admin()` is callable only by the service role.
4. Audit inserts derive `actor_id` from `auth.uid()` in a trigger, preventing
   the browser from forging the acting administrator.
5. No ordinary user's profile role is changed by this migration.

## Important Notes
- Existing profile rows already marked as admin are seeded into the allowlist
  so there is no lockout.
- Future provisioning must call the private service-role function.
- The allowlist contains identifiers only and is never exposed to customers.
*/

CREATE TABLE IF NOT EXISTS private.admin_allowlist (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text,
  revoked_at timestamptz
);

ALTER TABLE private.admin_allowlist ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON private.admin_allowlist FROM PUBLIC;
REVOKE ALL ON private.admin_allowlist FROM anon;
REVOKE ALL ON private.admin_allowlist FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.admin_allowlist TO service_role;

INSERT INTO private.admin_allowlist (user_id, granted_by)
SELECT p.id, 'existing_admin_allowlist_seed'
FROM public.profiles p
WHERE p.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.admin_allowlist a
    WHERE a.user_id = auth.uid()
      AND a.revoked_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO service_role;

CREATE OR REPLACE FUNCTION private.provision_admin(
  p_user_id uuid,
  p_granted_by text DEFAULT 'service_role'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user is required.';
  END IF;

  INSERT INTO private.admin_allowlist (user_id, granted_by, revoked_at)
  VALUES (p_user_id, COALESCE(NULLIF(p_granted_by, ''), 'service_role'), NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET granted_at = now(), granted_by = EXCLUDED.granted_by, revoked_at = NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.provision_admin(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.provision_admin(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION private.provision_admin(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.provision_admin(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION private.set_audit_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'An authenticated administrator is required.';
  END IF;
  NEW.actor_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_actor ON public.admin_audit_log;
CREATE TRIGGER admin_audit_actor
  BEFORE INSERT ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION private.set_audit_actor();

REVOKE ALL ON FUNCTION private.set_audit_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.set_audit_actor() FROM anon;
