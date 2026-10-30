-- Fix function execute permissions — revoke PUBLIC access
-- The REVOKE FROM anon, authenticated did not fully remove PUBLIC execute
-- on the two new SECURITY DEFINER functions. This migration explicitly
-- revokes from PUBLIC and re-grants to service_role only.

REVOKE EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_post_payment(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_order_post_payment(uuid) TO service_role;
