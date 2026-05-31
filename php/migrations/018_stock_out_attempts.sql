-- ============================================================
-- 018. Stock-out attempts log: track every refused purchase due to empty stock
-- ============================================================

CREATE TABLE IF NOT EXISTS tnsatbeltnd_stock_out_attempts (
    id VARCHAR(64) PRIMARY KEY,
    service_id VARCHAR(64) NOT NULL,
    client_id VARCHAR(64) DEFAULT NULL,
    reseller_id VARCHAR(64) DEFAULT NULL,
    attempted_credits DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES tnsatbeltnd_services(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES tnsatbeltnd_clients(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_soa_service ON tnsatbeltnd_stock_out_attempts(service_id);
CREATE INDEX idx_soa_client ON tnsatbeltnd_stock_out_attempts(client_id);
CREATE INDEX idx_soa_reseller ON tnsatbeltnd_stock_out_attempts(reseller_id);
CREATE INDEX idx_soa_created ON tnsatbeltnd_stock_out_attempts(created_at);
