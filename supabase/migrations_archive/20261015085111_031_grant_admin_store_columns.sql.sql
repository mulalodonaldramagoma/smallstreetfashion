-- Grant UPDATE on admin-controlled store columns to authenticated role.
-- A previous security audit (migration 026) revoked UPDATE on is_active,
-- is_verified, and is_demo from authenticated to prevent sellers from
-- self-activating or self-verifying. However, this also blocks admins
-- from managing stores because column-level privileges are checked
-- BEFORE RLS policies. The RLS policies stores_admin_update (requires
-- private.is_admin()) and stores_update_own (auth.uid() = seller_id)
-- still enforce proper access control.

GRANT UPDATE (is_active, is_verified, is_demo) ON stores TO authenticated;
