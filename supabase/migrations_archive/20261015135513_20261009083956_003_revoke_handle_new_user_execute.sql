-- Revoke execute on handle_new_user from anon and authenticated.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
