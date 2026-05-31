-- ============================================================
-- 020. Per-service visibility control for resellers
-- visibility_mode:
--   'all'       → every reseller sees the service (default)
--   'whitelist' → only resellers listed in tnsatbeltnd_reseller_service_visibility see it
--   'blacklist' → every reseller EXCEPT those listed sees it
-- ============================================================

ALTER TABLE tnsatbeltnd_services
  ADD COLUMN visibility_mode ENUM('all','whitelist','blacklist') NOT NULL DEFAULT 'all';

CREATE TABLE IF NOT EXISTS tnsatbeltnd_reseller_service_visibility (
    service_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (service_id, reseller_id),
    FOREIGN KEY (service_id) REFERENCES tnsatbeltnd_services(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_rsv_reseller ON tnsatbeltnd_reseller_service_visibility(reseller_id);
