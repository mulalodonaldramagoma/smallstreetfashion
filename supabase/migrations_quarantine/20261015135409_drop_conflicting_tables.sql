/*
# Drop earlier conflicting tables

Removes the simple categories/products/orders/order_items tables created by the
initial placeholder migration, so the full marketplace schema can be applied cleanly.
These tables had no data (empty), so no data loss.
*/

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
