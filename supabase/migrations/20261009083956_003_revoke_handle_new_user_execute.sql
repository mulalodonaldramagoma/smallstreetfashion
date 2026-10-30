-- Revoke execute on handle_new_user from anon and authenticated.
-- This function is a trigger fired by auth.users INSERT, not meant to be called via the REST API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
