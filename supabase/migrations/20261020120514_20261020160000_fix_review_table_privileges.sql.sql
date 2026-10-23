/*
# Fix review table privileges — defense in depth

## Problem
The original migrations created the review tables without explicitly restricting
Postgres-level privileges. Both `anon` and `authenticated` inherited full DML
access (INSERT, UPDATE, DELETE, TRUNCATE) on all four review tables. While RLS
policies prevent unauthorized access in practice, these broad privileges violate
the principle of least privilege and create a defense-in-depth gap.

Additionally, `review_reports` was missed by the previous column-privilege fix
migration, so `authenticated` retained full table-level UPDATE on all report
columns including `status`, `resolved_by`, and `resolution_note`.

## Fix
1. Revoke TRUNCATE from anon and authenticated on all review tables.
2. Revoke UPDATE from anon on all review tables (anon has no UPDATE policy).
3. Revoke UPDATE from authenticated on review_reports (admin updates go through
   the SECURITY DEFINER function admin_resolve_report, not direct table UPDATE).
4. Re-grant UPDATE only on safe columns (body, updated_at) for review_replies
   and (rating, body, updated_at) for product_reviews and store_reviews.
5. Revoke DELETE from anon on all review tables (anon has no DELETE policy).
6. Revoke INSERT from anon on review_replies and review_reports (anon has no
   INSERT policy on those).

## Notes
- RLS remains the primary access control. These privilege changes add a second
  layer of protection.
- The admin_resolve_report SECURITY DEFINER function handles report status
  changes, so authenticated does not need direct UPDATE on review_reports.
- No existing data is modified. No tables or columns are changed.
*/

-- ============================================================
-- product_reviews
-- ============================================================
REVOKE TRUNCATE ON public.product_reviews FROM anon, authenticated;
REVOKE UPDATE ON public.product_reviews FROM anon;
REVOKE DELETE ON public.product_reviews FROM anon;
-- authenticated: only allow UPDATE on rating, body, updated_at (already column-granted)
-- Ensure table-level UPDATE is revoked and column-level re-granted
REVOKE UPDATE ON public.product_reviews FROM authenticated;
GRANT UPDATE (rating, body, updated_at) ON public.product_reviews TO authenticated;

-- ============================================================
-- store_reviews
-- ============================================================
REVOKE TRUNCATE ON public.store_reviews FROM anon, authenticated;
REVOKE UPDATE ON public.store_reviews FROM anon;
REVOKE DELETE ON public.store_reviews FROM anon;
REVOKE UPDATE ON public.store_reviews FROM authenticated;
GRANT UPDATE (rating, body, updated_at) ON public.store_reviews TO authenticated;

-- ============================================================
-- review_replies
-- ============================================================
REVOKE TRUNCATE ON public.review_replies FROM anon, authenticated;
REVOKE UPDATE ON public.review_replies FROM anon;
REVOKE DELETE ON public.review_replies FROM anon;
REVOKE INSERT ON public.review_replies FROM anon;
REVOKE UPDATE ON public.review_replies FROM authenticated;
GRANT UPDATE (body, updated_at) ON public.review_replies TO authenticated;

-- ============================================================
-- review_reports
-- ============================================================
-- Reports should never be directly updated by any client role.
-- Admins use the admin_resolve_report SECURITY DEFINER function.
REVOKE TRUNCATE ON public.review_reports FROM anon, authenticated;
REVOKE UPDATE ON public.review_reports FROM anon;
REVOKE UPDATE ON public.review_reports FROM authenticated;
REVOKE DELETE ON public.review_reports FROM anon;
REVOKE INSERT ON public.review_reports FROM anon;
