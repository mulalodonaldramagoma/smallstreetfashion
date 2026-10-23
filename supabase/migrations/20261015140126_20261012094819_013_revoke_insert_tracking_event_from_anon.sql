-- Revoke EXECUTE from anon for insert_tracking_event
REVOKE EXECUTE ON FUNCTION insert_tracking_event(uuid, text, text, text, timestamptz, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION insert_tracking_event(uuid, text, text, text, timestamptz, text, jsonb) TO service_role;
