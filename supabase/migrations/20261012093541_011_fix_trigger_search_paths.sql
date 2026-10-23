-- Fix search_path warnings on trigger functions
ALTER FUNCTION public.update_deliveries_updated_at() SET search_path = public;
ALTER FUNCTION public.update_delivery_methods_updated_at() SET search_path = public;
ALTER FUNCTION public.update_delivery_zones_updated_at() SET search_path = public;
