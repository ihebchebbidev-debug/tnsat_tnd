-- ============================================================
-- 021. Per-category visibility control for resellers
-- visibility_mode:
--   'all'       → every reseller sees the category (default)
--   'whitelist' → only listed resellers see it
--   'blacklist' → every reseller EXCEPT those listed sees it
-- Hidden categories also hide their services for that reseller.
-- ============================================================

ALTER TABLE tnsatbeltnd_categories
  ADD COLUMN visibility_mode ENUM('all','whitelist','blacklist') NOT NULL DEFAULT 'all';

CREATE TABLE IF NOT EXISTS tnsatbeltnd_reseller_category_visibility (
    category_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category_id, reseller_id),
    FOREIGN KEY (category_id) REFERENCES tnsatbeltnd_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_rcv_reseller ON tnsatbeltnd_reseller_category_visibility(reseller_id);
