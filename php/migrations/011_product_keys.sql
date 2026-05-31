-- ============================================================
-- 11. Product Keys (stock of keys/codes per service)
-- Each key is a set of title-value pairs (e.g. username/password, activation code, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS tnsatbeltnd_product_keys (
    id VARCHAR(64) PRIMARY KEY,
    service_id VARCHAR(64) NOT NULL,
    fields JSON NOT NULL COMMENT 'Array of {title, value} pairs',
    status ENUM('available', 'assigned') NOT NULL DEFAULT 'available',
    order_id VARCHAR(64) DEFAULT NULL,
    assigned_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES tnsatbeltnd_services(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES tnsatbeltnd_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_pk_service ON tnsatbeltnd_product_keys(service_id);
CREATE INDEX idx_pk_status ON tnsatbeltnd_product_keys(status);
CREATE INDEX idx_pk_order ON tnsatbeltnd_product_keys(order_id);
