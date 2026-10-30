-- Revoke EXECUTE from anon for the new SECURITY DEFINER function
-- insert_tracking_event is only called from edge functions (service role)
REVOKE EXECUTE ON FUNCTION insert_tracking_event(
  uuid, text, text, text, timestamptz, text, jsonb
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION insert_tracking_event(
  uuid, text, text, text, timestamptz, text, jsonb
) TO service_role;
