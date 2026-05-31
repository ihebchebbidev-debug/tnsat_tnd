-- ============================================================
-- TNSAT BEL TND — Consolidated Database Schema (MySQL)
-- TND-only platform. All tables use the `tnsatbeltnd_` prefix.
-- Run this once to set up (or RESET) the database from scratch.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS tnsatbeltnd_reseller_category_visibility;
DROP TABLE IF EXISTS tnsatbeltnd_reseller_service_visibility;
DROP TABLE IF EXISTS tnsatbeltnd_reseller_service_prices;
DROP TABLE IF EXISTS tnsatbeltnd_stock_out_attempts;
DROP TABLE IF EXISTS tnsatbeltnd_global_message_reads;
DROP TABLE IF EXISTS tnsatbeltnd_global_messages;
DROP TABLE IF EXISTS tnsatbeltnd_reset_products;
DROP TABLE IF EXISTS tnsatbeltnd_order_responses;
DROP TABLE IF EXISTS tnsatbeltnd_product_keys;
DROP TABLE IF EXISTS tnsatbeltnd_categories;
DROP TABLE IF EXISTS tnsatbeltnd_settings;
DROP TABLE IF EXISTS tnsatbeltnd_recharge_codes;
DROP TABLE IF EXISTS tnsatbeltnd_contact_messages;
DROP TABLE IF EXISTS tnsatbeltnd_point_transactions;
DROP TABLE IF EXISTS tnsatbeltnd_notifications;
DROP TABLE IF EXISTS tnsatbeltnd_complaints;
DROP TABLE IF EXISTS tnsatbeltnd_orders;
DROP TABLE IF EXISTS tnsatbeltnd_services;
DROP TABLE IF EXISTS tnsatbeltnd_delivery_types;
DROP TABLE IF EXISTS tnsatbeltnd_resellers;
DROP TABLE IF EXISTS tnsatbeltnd_clients;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 1. Clients
-- `credits` column stores the balance in TND (1 unit = 1 TND).
-- ============================================================
CREATE TABLE tnsatbeltnd_clients (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(128) NOT NULL,
    credits DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. Resellers (self-referencing for sub-resellers)
-- `credits` column stores the balance in TND.
-- ============================================================
CREATE TABLE tnsatbeltnd_resellers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(128) NOT NULL,
    credits DECIMAL(10,2) NOT NULL DEFAULT 0,
    can_add_resellers TINYINT(1) NOT NULL DEFAULT 0,
    parent_reseller_id VARCHAR(64) DEFAULT NULL,
    note TEXT DEFAULT NULL,
    level INT NOT NULL DEFAULT 1,
    country VARCHAR(10) DEFAULT 'TN',
    currency VARCHAR(10) DEFAULT 'TND',
    image_url TEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. Delivery Types (credential templates)
-- ============================================================
CREATE TABLE tnsatbeltnd_delivery_types (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    fields JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. Services (products)
-- `price_credits` stores the price in TND. `price_tnd` is kept
-- for back-compat but the app reads `price_credits`.
-- sale_type:
--   'stock'   → instant key delivery from product_keys pool
--   'command' → manual fulfillment by admin
-- visibility_mode:
--   'all' | 'whitelist' | 'blacklist'
-- ============================================================
CREATE TABLE tnsatbeltnd_services (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    price_tnd DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_credits DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock INT DEFAULT NULL,
    delivery_type_id VARCHAR(64),
    category VARCHAR(100) DEFAULT NULL,
    sale_type ENUM('stock', 'command') NOT NULL DEFAULT 'command',
    visibility_mode ENUM('all','whitelist','blacklist') NOT NULL DEFAULT 'all',
    specifications JSON DEFAULT NULL,
    features JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (delivery_type_id) REFERENCES tnsatbeltnd_delivery_types(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. Orders
-- `credits_used` stores the amount paid in TND.
-- ============================================================
CREATE TABLE tnsatbeltnd_orders (
    id VARCHAR(64) PRIMARY KEY,
    client_id VARCHAR(64) DEFAULT NULL,
    reseller_id VARCHAR(64) DEFAULT NULL,
    service_id VARCHAR(64) NOT NULL,
    credits_used DECIMAL(10,2) NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    duration_months INT NOT NULL DEFAULT 12,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    delivery_type_id VARCHAR(64),
    credentials JSON DEFAULT NULL,
    note TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at DATETIME DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES tnsatbeltnd_clients(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES tnsatbeltnd_services(id) ON DELETE CASCADE,
    FOREIGN KEY (delivery_type_id) REFERENCES tnsatbeltnd_delivery_types(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. Complaints
-- ============================================================
CREATE TABLE tnsatbeltnd_complaints (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    client_id VARCHAR(64) DEFAULT NULL,
    reseller_id VARCHAR(64) DEFAULT NULL,
    reason VARCHAR(30) NOT NULL DEFAULT 'other',
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    admin_response TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES tnsatbeltnd_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES tnsatbeltnd_clients(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. Notifications
-- ============================================================
CREATE TABLE tnsatbeltnd_notifications (
    id VARCHAR(64) PRIMARY KEY,
    client_id VARCHAR(64) DEFAULT NULL,
    reseller_id VARCHAR(64) DEFAULT NULL,
    type VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    reseller_note TEXT DEFAULT NULL,
    order_id VARCHAR(64) DEFAULT NULL,
    complaint_id VARCHAR(64) DEFAULT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES tnsatbeltnd_clients(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES tnsatbeltnd_orders(id) ON DELETE SET NULL,
    FOREIGN KEY (complaint_id) REFERENCES tnsatbeltnd_complaints(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. TND Transactions (audit log) — historical table name kept.
-- amount / balance_after are in TND.
-- ============================================================
CREATE TABLE tnsatbeltnd_point_transactions (
    id VARCHAR(64) PRIMARY KEY,
    client_id VARCHAR(64) DEFAULT NULL,
    reseller_id VARCHAR(64) DEFAULT NULL,
    type ENUM('credit', 'debit') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    description TEXT DEFAULT NULL,
    is_paid TINYINT(1) NOT NULL DEFAULT 0,
    order_id VARCHAR(64) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES tnsatbeltnd_clients(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES tnsatbeltnd_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. Contact Messages
-- ============================================================
CREATE TABLE tnsatbeltnd_contact_messages (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(200) DEFAULT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. Recharge Codes (admin creates, resellers redeem)
-- `credits` column stores the voucher value in TND.
-- ============================================================
CREATE TABLE tnsatbeltnd_recharge_codes (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    credits DECIMAL(10,2) NOT NULL,
    is_used TINYINT(1) NOT NULL DEFAULT 0,
    used_by_reseller_id VARCHAR(64) DEFAULT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (used_by_reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. Settings (key-value config)
-- ============================================================
CREATE TABLE tnsatbeltnd_settings (
    id VARCHAR(64) PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 12. Categories (product grouping with images & visibility)
-- ============================================================
CREATE TABLE tnsatbeltnd_categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    image_url TEXT DEFAULT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    visibility_mode ENUM('all','whitelist','blacklist') NOT NULL DEFAULT 'all',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tnsatbeltnd_categories (id, name, image_url, sort_order) VALUES
(HEX(RANDOM_BYTES(16)), 'IPTV ACTIVE CODE', '', 1),
(HEX(RANDOM_BYTES(16)), 'XTREAM IPTV',      '', 2),
(HEX(RANDOM_BYTES(16)), 'TEST-IPTV',        '', 3),
(HEX(RANDOM_BYTES(16)), 'NETFLIX',          '', 4),
(HEX(RANDOM_BYTES(16)), 'IBOPLAYER',        '', 5);

-- ============================================================
-- 13. Product Keys (stock of keys/codes per service)
-- ============================================================
CREATE TABLE tnsatbeltnd_product_keys (
    id VARCHAR(64) PRIMARY KEY,
    service_id VARCHAR(64) NOT NULL,
    fields JSON NOT NULL COMMENT 'Array of {title, value} pairs',
    status ENUM('available', 'assigned') NOT NULL DEFAULT 'available',
    order_id VARCHAR(64) DEFAULT NULL,
    assigned_at DATETIME DEFAULT NULL,
    reseller_note TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES tnsatbeltnd_services(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES tnsatbeltnd_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 14. Order Responses (reseller replies to fulfilled orders)
-- ============================================================
CREATE TABLE tnsatbeltnd_order_responses (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) DEFAULT NULL,
    client_id VARCHAR(64) DEFAULT NULL,
    response_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES tnsatbeltnd_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES tnsatbeltnd_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 15. Reset Products (admin-managed catalog for reset requests)
-- ============================================================
CREATE TABLE tnsatbeltnd_reset_products (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT DEFAULT NULL,
    image_url TEXT DEFAULT NULL,
    fields JSON NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tnsatbeltnd_reset_products (id, name, description, image_url, fields, sort_order) VALUES
(REPLACE(UUID(),'-',''), 'IPTV Active Code', 'Demande de réinitialisation pour Active Code IPTV', '',
 JSON_ARRAY(
   JSON_OBJECT('key','active_code','label','Active Code','type','text','required',true),
   JSON_OBJECT('key','mac','label','MAC Address','type','text','required',false),
   JSON_OBJECT('key','note','label','Note','type','textarea','required',false)
 ), 1),
(REPLACE(UUID(),'-',''), 'Xtream IPTV', 'Demande de réinitialisation pour Xtream codes', '',
 JSON_ARRAY(
   JSON_OBJECT('key','username','label','Username','type','text','required',true),
   JSON_OBJECT('key','password','label','Password','type','text','required',true),
   JSON_OBJECT('key','server','label','Server URL','type','text','required',false),
   JSON_OBJECT('key','note','label','Note','type','textarea','required',false)
 ), 2),
(REPLACE(UUID(),'-',''), 'M3U / Playlist', 'Demande de réinitialisation pour lien M3U', '',
 JSON_ARRAY(
   JSON_OBJECT('key','m3u_url','label','M3U URL','type','text','required',true),
   JSON_OBJECT('key','ip','label','IP','type','text','required',false),
   JSON_OBJECT('key','note','label','Note','type','textarea','required',false)
 ), 3);

-- ============================================================
-- 16. Global Messages (admin broadcasts + per-reseller reads)
-- ============================================================
CREATE TABLE tnsatbeltnd_global_messages (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    image_url VARCHAR(500) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tnsatbeltnd_global_message_reads (
    id VARCHAR(64) PRIMARY KEY,
    message_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_msg_reseller (message_id, reseller_id),
    FOREIGN KEY (message_id) REFERENCES tnsatbeltnd_global_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 17. Stock-out attempts log (refused purchases due to empty stock)
-- ============================================================
CREATE TABLE tnsatbeltnd_stock_out_attempts (
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

-- ============================================================
-- 18. Per-reseller custom price overrides (in TND)
-- ============================================================
CREATE TABLE tnsatbeltnd_reseller_service_prices (
    service_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) NOT NULL,
    price_credits DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (service_id, reseller_id),
    FOREIGN KEY (service_id) REFERENCES tnsatbeltnd_services(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 19. Per-service visibility list (whitelist/blacklist resellers)
-- ============================================================
CREATE TABLE tnsatbeltnd_reseller_service_visibility (
    service_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (service_id, reseller_id),
    FOREIGN KEY (service_id) REFERENCES tnsatbeltnd_services(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 20. Per-category visibility list (whitelist/blacklist resellers)
-- ============================================================
CREATE TABLE tnsatbeltnd_reseller_category_visibility (
    category_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category_id, reseller_id),
    FOREIGN KEY (category_id) REFERENCES tnsatbeltnd_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_orders_client          ON tnsatbeltnd_orders(client_id);
CREATE INDEX idx_orders_reseller        ON tnsatbeltnd_orders(reseller_id);
CREATE INDEX idx_orders_status          ON tnsatbeltnd_orders(status);
CREATE INDEX idx_complaints_client      ON tnsatbeltnd_complaints(client_id);
CREATE INDEX idx_complaints_reseller    ON tnsatbeltnd_complaints(reseller_id);
CREATE INDEX idx_complaints_status      ON tnsatbeltnd_complaints(status);
CREATE INDEX idx_notifications_client   ON tnsatbeltnd_notifications(client_id);
CREATE INDEX idx_notifications_reseller ON tnsatbeltnd_notifications(reseller_id);
CREATE INDEX idx_notifications_read     ON tnsatbeltnd_notifications(is_read);
CREATE INDEX idx_resellers_parent       ON tnsatbeltnd_resellers(parent_reseller_id);
CREATE INDEX idx_pt_client              ON tnsatbeltnd_point_transactions(client_id);
CREATE INDEX idx_pt_reseller            ON tnsatbeltnd_point_transactions(reseller_id);
CREATE INDEX idx_pt_type                ON tnsatbeltnd_point_transactions(type);
CREATE INDEX idx_rc_used                ON tnsatbeltnd_recharge_codes(is_used);
CREATE INDEX idx_rc_code                ON tnsatbeltnd_recharge_codes(code);
CREATE INDEX idx_services_category      ON tnsatbeltnd_services(category);
CREATE INDEX idx_services_sale_type     ON tnsatbeltnd_services(sale_type);
CREATE INDEX idx_pk_service             ON tnsatbeltnd_product_keys(service_id);
CREATE INDEX idx_pk_status              ON tnsatbeltnd_product_keys(status);
CREATE INDEX idx_pk_order               ON tnsatbeltnd_product_keys(order_id);
CREATE INDEX idx_order_responses_order    ON tnsatbeltnd_order_responses(order_id);
CREATE INDEX idx_order_responses_reseller ON tnsatbeltnd_order_responses(reseller_id);
CREATE INDEX idx_reset_products_active  ON tnsatbeltnd_reset_products(is_active);
CREATE INDEX idx_reset_products_sort    ON tnsatbeltnd_reset_products(sort_order);
CREATE INDEX idx_gm_active              ON tnsatbeltnd_global_messages(is_active);
CREATE INDEX idx_gmr_message            ON tnsatbeltnd_global_message_reads(message_id);
CREATE INDEX idx_gmr_reseller           ON tnsatbeltnd_global_message_reads(reseller_id);
CREATE INDEX idx_soa_service            ON tnsatbeltnd_stock_out_attempts(service_id);
CREATE INDEX idx_soa_client             ON tnsatbeltnd_stock_out_attempts(client_id);
CREATE INDEX idx_soa_reseller           ON tnsatbeltnd_stock_out_attempts(reseller_id);
CREATE INDEX idx_soa_created            ON tnsatbeltnd_stock_out_attempts(created_at);
CREATE INDEX idx_rsp_reseller           ON tnsatbeltnd_reseller_service_prices(reseller_id);
CREATE INDEX idx_rsv_reseller           ON tnsatbeltnd_reseller_service_visibility(reseller_id);
CREATE INDEX idx_rcv_reseller           ON tnsatbeltnd_reseller_category_visibility(reseller_id);
