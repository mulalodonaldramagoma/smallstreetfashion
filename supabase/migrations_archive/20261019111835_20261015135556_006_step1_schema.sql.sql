-- Step 1: Add demo-tracking columns to stores
ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS research_date date,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Step 2: Make seller_id nullable so unclaimed demo stores can exist
ALTER TABLE stores ALTER COLUMN seller_id DROP NOT NULL;

-- Step 3: Add demo-tracking columns to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_url text;
