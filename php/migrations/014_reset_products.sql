-- ============================================================
-- 014: Reset Products — admin-managed catalog of items
-- a reseller can request a reset for. Each product defines
-- its own set of dynamic input fields (similar to delivery types).
-- ============================================================

CREATE TABLE IF NOT EXISTS tnsatbeltnd_reset_products (
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

CREATE INDEX idx_reset_products_active ON tnsatbeltnd_reset_products(is_active);
CREATE INDEX idx_reset_products_sort ON tnsatbeltnd_reset_products(sort_order);

-- Seed a few examples (admin can edit/delete)
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
