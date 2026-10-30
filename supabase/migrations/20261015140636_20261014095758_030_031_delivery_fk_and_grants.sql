-- 030: Add missing FK from delivery_methods.zone_id to delivery_zones.id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'delivery_methods_zone_id_fkey'
    AND table_name = 'delivery_methods'
  ) THEN
    ALTER TABLE delivery_methods
      ADD CONSTRAINT delivery_methods_zone_id_fkey
      FOREIGN KEY (zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 031: Grant UPDATE on admin-controlled store columns to authenticated
GRANT UPDATE (is_active, is_verified, is_demo) ON stores TO authenticated;
