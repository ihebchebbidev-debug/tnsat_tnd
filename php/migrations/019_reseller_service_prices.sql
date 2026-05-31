-- ============================================================
-- 019. Per-reseller custom price overrides for services
-- If a row exists for (service_id, reseller_id), the reseller pays
-- that custom price_credits instead of the service's default.
-- ============================================================

CREATE TABLE IF NOT EXISTS tnsatbeltnd_reseller_service_prices (
    service_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) NOT NULL,
    price_credits DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (service_id, reseller_id),
    FOREIGN KEY (service_id) REFERENCES tnsatbeltnd_services(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_rsp_reseller ON tnsatbeltnd_reseller_service_prices(reseller_id);
