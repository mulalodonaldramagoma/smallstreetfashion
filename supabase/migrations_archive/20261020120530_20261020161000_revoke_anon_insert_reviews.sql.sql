/*
# Revoke anon INSERT on review tables

## Problem
`anon` still has INSERT privilege on `product_reviews` and `store_reviews`.
While RLS policies block anon inserts (insert policies are TO authenticated only),
this privilege should be revoked for defense-in-depth consistency.

## Fix
Revoke INSERT from anon on product_reviews and store_reviews.
*/

REVOKE INSERT ON public.product_reviews FROM anon;
REVOKE INSERT ON public.store_reviews FROM anon;
