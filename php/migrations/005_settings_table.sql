-- Settings table for dynamic app configuration
CREATE TABLE IF NOT EXISTS tnsatbeltnd_settings (
    id VARCHAR(64) PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default credits_per_tnd
INSERT INTO tnsatbeltnd_settings (id, setting_key, setting_value)
VALUES (HEX(RANDOM_BYTES(16)), 'credits_per_tnd', '10')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
