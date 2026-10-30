/*
# Restrict Privileged Functions to Server-Side Calls

## Overview
Removes browser access to the remaining SECURITY DEFINER functions flagged by
Supabase's security advisor. These functions are not called by the frontend;
checkout and administration are handled by trusted server-side code.

## Security Changes
- `admin_set_user_role` — service role only
- `decrement_stock` — service role only
- `generate_order_number` — service role only
- Anonymous access was already revoked and remains revoked.

## Important Notes
- No tables or user data are changed.
- SECURITY DEFINER functions remain protected by fixed search paths.
- Server-side edge functions retain the access they need.
*/

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;
