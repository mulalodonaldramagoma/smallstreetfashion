/*
# Decrement Stock Function (Stage 5)

Creates a SECURITY DEFINER function to atomically decrement product stock
after a verified payment. This is called only from edge functions using
the service role key.

## Functions

- **decrement_stock(p_product_id uuid, p_quantity integer)**
  Atomically decrements stock by the given quantity, ensuring stock does
  not go below zero. Returns the new stock level.

## Security

- SECURITY DEFINER — runs with the function owner's privileges (service role)
- Not callable by anon or authenticated roles — only via service role from edge functions
*/

CREATE OR REPLACE FUNCTION decrement_stock(p_product_id uuid, p_quantity integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stock integer;
BEGIN
  UPDATE products
  SET stock = GREATEST(stock - p_quantity, 0),
      updated_at = now()
  WHERE id = p_product_id
  RETURNING stock INTO new_stock;

  RETURN new_stock;
END;
$$;
