/*
# Stage 7: Delivery Management

## Purpose
Add delivery infrastructure to Small Street Fashion:
1. Configurable delivery methods (standard, express, pickup) with admin-set fees
2. Delivery records linked to existing orders with status tracking
3. Delivery address validation already exists in checkout — this extends it with method selection
4. Seller dispatch preparation (mark orders as prepared/ready for dispatch)
5. Customer-facing delivery status tracking

## New Tables

### delivery_methods
- `id` (uuid, PK)
- `name` (text, not null) — e.g. "Standard Delivery", "Express Delivery", "Store Pickup"
- `description` (text, nullable) — human-readable description
- `fee` (numeric, not null, default 0) — delivery fee in ZAR
- `estimated_days` (text, nullable) — e.g. "3-5 business days"
- `is_active` (boolean, default true) — whether this method is available at checkout
- `sort_order` (integer, default 0) — display ordering
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### deliveries
- `id` (uuid, PK)
- `order_id` (uuid, FK to orders.id, not null) — the order this delivery belongs to
- `delivery_method_id` (uuid, FK to delivery_methods.id, nullable) — selected delivery method
- `delivery_fee` (numeric, not null, default 0) — fee charged to customer (snapshot at order time)
- `status` (text, not null, default 'pending') — delivery lifecycle:
    'pending' → 'preparing' → 'ready_for_dispatch' → 'dispatched' → 'delivered'
    (no auto-transitions; seller/admin manually advances each step)
- `tracking_note` (text, nullable) — seller/admin can add notes at each status change
- `dispatched_at` (timestamptz, nullable) — set when seller marks as dispatched
- `delivered_at` (timestamptz, nullable) — set when marked as delivered
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Modified Tables
- `orders` — adds `delivery_method_id` (uuid, FK, nullable) to store the selected method

## Security (RLS)

### delivery_methods (public read, admin write)
- SELECT: TO anon, authenticated (anyone can see available methods at checkout)
- INSERT/UPDATE/DELETE: TO authenticated, only admin role (checked via profiles table)

### deliveries (customer sees own, seller sees their store's, admin sees all)
- SELECT: TO authenticated — customer sees own orders' deliveries, seller sees deliveries for their store's orders, admin sees all
- UPDATE: TO authenticated — seller can update deliveries for their store's orders, admin can update any
- INSERT: handled server-side by edge function (service role bypasses RLS)
- DELETE: admin only

## Important Notes
1. No courier integration — status transitions are manual (Stage 8)
2. Orders are never auto-marked as shipped or delivered
3. Existing order with R65 delivery fee is preserved — the delivery_fee column on deliveries snapshots the fee at order time
4. The delivery_methods table is seeded with a "Standard Delivery" method matching the current R65 fee
5. The paystack-initialize edge function will be updated to accept a delivery_method_id and look up the fee server-side
*/
