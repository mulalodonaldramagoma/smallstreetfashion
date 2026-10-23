/*
# Decrement Stock Function (Stage 5)
SECURITY DEFINER function to atomically decrement product stock after verified payment.
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
