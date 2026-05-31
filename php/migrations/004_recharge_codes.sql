-- Migration 004: Recharge codes system
-- Admin creates codes with credit values, resellers redeem them

CREATE TABLE IF NOT EXISTS tnsatbeltnd_recharge_codes (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    credits DECIMAL(10,2) NOT NULL,
    is_used TINYINT(1) NOT NULL DEFAULT 0,
    used_by_reseller_id VARCHAR(64) DEFAULT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (used_by_reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add category field to services
ALTER TABLE tnsatbeltnd_services ADD COLUMN category VARCHAR(100) DEFAULT NULL AFTER delivery_type_id;
