-- Categories table for product grouping
CREATE TABLE IF NOT EXISTS tnsatbeltnd_categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    image_url TEXT DEFAULT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default categories
INSERT INTO tnsatbeltnd_categories (id, name, image_url, sort_order) VALUES
(HEX(RANDOM_BYTES(16)), 'IPTV ACTIVE CODE', '', 1),
(HEX(RANDOM_BYTES(16)), 'XTREAM IPTV', '', 2),
(HEX(RANDOM_BYTES(16)), 'TEST-IPTV', '', 3),
(HEX(RANDOM_BYTES(16)), 'NETFLIX', '', 4),
(HEX(RANDOM_BYTES(16)), 'IBOPLAYER', '', 5);
