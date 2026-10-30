-- Add missing foreign key from delivery_methods.zone_id to delivery_zones.id
-- Without this FK, PostgREST cannot resolve the join in the select query
-- `delivery_zone:delivery_zones(*)`, causing the checkout to silently fail
-- and show "No delivery methods available."
--
-- The FK was auto-created by migration 010 (ADD COLUMN zone_id REFERENCES delivery_zones(id))
-- but with the default ON DELETE NO ACTION. This migration replaces it with ON DELETE SET NULL
-- so deleting a zone doesn't block removal of delivery methods referencing it.

ALTER TABLE delivery_methods
  DROP CONSTRAINT IF EXISTS delivery_methods_zone_id_fkey;

ALTER TABLE delivery_methods
  ADD CONSTRAINT delivery_methods_zone_id_fkey
  FOREIGN KEY (zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL;