/*
# Orders and Payment Transactions (Stage 5)

Creates the orders, order_items, and payment_transactions tables to support
the Paystack payment integration. Orders store customer delivery details and
a snapshot of the items at purchase time. Payment transactions track the
Paystack reference, status, and verification state.

## Tables

1. **orders** — customer orders
   - id (uuid, PK)
   - user_id (uuid, nullable — supports guest checkout, references auth.users)
   - order_number (text, unique, human-readable e.g. SSF-20261010-XXXX)
   - customer_name, customer_email, customer_phone (text)
   - delivery_address, suburb, city, province, postal_code (text)
   - delivery_instructions (text, nullable)
   - subtotal, delivery_fee, total (numeric, server-calculated)
   - status (text: 'pending' | 'paid' | 'cancelled' | 'failed' | 'refunded', default 'pending')
   - created_at, updated_at (timestamps)

2. **order_items** — line items per order (snapshot at purchase time)
   - id (uuid, PK)
   - order_id (uuid, references orders, cascade delete)
   - product_id (uuid, references products)
   - store_id (uuid, references stores)
   - product_name, product_image (text — snapshot)
   - size, colour (text)
   - quantity (integer)
   - unit_price (numeric — snapshot of price at order time)
   - line_total (numeric — quantity * unit_price, server-calculated)

3. **payment_transactions** — Paystack payment records
   - id (uuid, PK)
   - order_id (uuid, references orders, cascade delete)
   - reference (text, unique — Paystack transaction reference)
   - provider (text, default 'paystack')
   - amount (numeric — in ZAR, server-calculated)
   - currency (text, default 'ZAR')
   - status (text: 'pending' | 'success' | 'failed' | 'cancelled' | 'abandoned', default 'pending')
   - paystack_access_code (text, nullable)
   - verified_at (timestamptz, nullable — when server-side verification confirmed)
   - paystack_response (jsonb, nullable — raw verification response for audit)
   - created_at, updated_at (timestamps)

## Security (RLS)

- **orders**: authenticated users can read their own orders; anon cannot read.
  Inserts/updates are performed via service role (edge functions) — no client INSERT/UPDATE policy.
  This prevents the browser from creating or modifying orders directly.
- **order_items**: readable only by the order owner (join through orders).
  Inserts performed via service role only.
- **payment_transactions**: readable only by the order owner.
  Inserts/updates performed via service role only.

## Indexes

- idx_orders_user_id — filter orders by user
- idx_order_items_order_id — join items to order
- idx_payment_transactions_order_id — join transactions to order
- idx_payment_transactions_reference — look up by Paystack reference

## Notes

1. Orders and payment_transactions are created ONLY by edge functions using the
   service role key — the frontend never inserts or updates these tables directly.
   This ensures server-calculated prices, stock validation, and payment verification.
2. The order_number is generated server-side using a sequence + date prefix.
3. Amount in payment_transactions matches the server-calculated order total,
   not the browser-submitted amount.
4. The `verified_at` column is set only after the Paystack API confirms the transaction —
   a success redirect alone does NOT mark a payment as verified.
*/

-- ============ SEQUENCE FOR ORDER NUMBERS ============
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  delivery_address text NOT NULL,
  suburb text NOT NULL,
  city text NOT NULL,
  province text NOT NULL,
  postal_code text NOT NULL,
  delivery_instructions text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own orders
DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own"
  ON orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for client — only service role (edge functions) can write

-- ============ ORDER_ITEMS ============
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  product_image text,
  size text NOT NULL,
  colour text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Order owner can read their order items
DROP POLICY IF EXISTS "order_items_select_own" ON order_items;
CREATE POLICY "order_items_select_own"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Sellers can read order_items for their store's products
DROP POLICY IF EXISTS "order_items_select_seller" ON order_items;
CREATE POLICY "order_items_select_seller"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = order_items.store_id
      AND stores.seller_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for client — only service role (edge functions) can write

-- ============ PAYMENT_TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reference text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'paystack',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'abandoned')),
  paystack_access_code text,
  verified_at timestamptz,
  paystack_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Order owner can read their payment transactions
DROP POLICY IF EXISTS "payment_transactions_select_own" ON payment_transactions;
CREATE POLICY "payment_transactions_select_own"
  ON payment_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payment_transactions.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for client — only service role (edge functions) can write

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_store_id ON order_items(store_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference);

-- ============ FUNCTION: generate order number ============
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'SSF-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('order_number_seq')::text, 5, '0');
$$;
