-- Add new fields to tnsatbeltnd_resellers for B2B reseller management
ALTER TABLE tnsatbeltnd_resellers
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT NULL AFTER can_add_resellers,
  ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1 AFTER note,
  ADD COLUMN IF NOT EXISTS country VARCHAR(5) DEFAULT 'TN' AFTER level,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'TND' AFTER country;

-- Add quantity and note to orders
ALTER TABLE tnsatbeltnd_orders
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1 AFTER points_used,
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT NULL AFTER quantity;

-- Add category support for services
ALTER TABLE tnsatbeltnd_services
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT NULL AFTER name;

-- Index for category
CREATE INDEX IF NOT EXISTS idx_services_category ON tnsatbeltnd_services(category);
