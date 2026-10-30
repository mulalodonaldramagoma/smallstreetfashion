-- Fix function execute permissions — revoke PUBLIC access
REVOKE EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_post_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_seller_earnings_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_order_post_payment(uuid) TO service_role;