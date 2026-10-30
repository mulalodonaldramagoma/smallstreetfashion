/*
# Grant reconciliation function execution to authenticated role

The get_reconciliation_summary function uses SECURITY DEFINER with an internal
is_admin() check. Authenticated admins need to call it via RPC from the frontend.
The function itself enforces admin-only access, so granting to authenticated
is safe — non-admins will get an error from the function body.
*/

GRANT EXECUTE ON FUNCTION public.get_reconciliation_summary(timestamptz, timestamptz, text, uuid, text, text) TO authenticated;
