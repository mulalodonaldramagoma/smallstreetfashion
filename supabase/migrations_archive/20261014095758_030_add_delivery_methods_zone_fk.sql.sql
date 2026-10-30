-- Add missing foreign key from delivery_methods.zone_id to delivery_zones.id
-- Without this FK, PostgREST cannot resolve the join in the select query
-- `delivery_zone:delivery_zones(*)`, causing the checkout to silently fail
-- and show "No delivery methods available."

ALTER TABLE delivery_methods
  ADD CONSTRAINT delivery_methods_zone_id_fkey
  FOREIGN KEY (zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL;
