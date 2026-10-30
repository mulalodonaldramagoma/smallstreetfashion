/*
# Explicit Deny Policy on admin_allowlist

## Overview
The private.admin_allowlist table has RLS enabled but no policies, which
triggers Supabase's RLS linter. The table is only accessible via the
service_role (which bypasses RLS), so no policies is correct behavior.
This migration adds an explicit deny-by-default policy for authenticated
and anon roles to satisfy the linter and document the intent.

## Security Changes
- Adds a SELECT policy that always evaluates to false for authenticated/anon.
- service_role bypasses RLS entirely, so provisioning still works.
- No changes to existing data or access patterns.
*/

DROP POLICY IF EXISTS "admin_allowlist_deny_all" ON private.admin_allowlist;
CREATE POLICY "admin_allowlist_deny_all"
  ON private.admin_allowlist FOR SELECT
  TO anon, authenticated
  USING (false);
