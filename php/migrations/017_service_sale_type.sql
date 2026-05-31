-- ============================================================
-- 017. Service sale type: 'stock' (instant key delivery) or 'command' (manual fulfillment)
-- ============================================================

ALTER TABLE tnsatbeltnd_services
  ADD COLUMN sale_type ENUM('stock', 'command') NOT NULL DEFAULT 'command' AFTER category;

CREATE INDEX idx_services_sale_type ON tnsatbeltnd_services(sale_type);

-- Existing services that already have product keys → mark as 'stock'
UPDATE tnsatbeltnd_services s
SET sale_type = 'stock'
WHERE EXISTS (SELECT 1 FROM tnsatbeltnd_product_keys pk WHERE pk.service_id = s.id);
