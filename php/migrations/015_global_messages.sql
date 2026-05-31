-- ============================================================
-- 015: Global Messages — admin broadcasts shown to all resellers
-- on login. Each reseller's "read" state is tracked individually
-- so the admin can see who has acknowledged the message.
-- ============================================================

CREATE TABLE IF NOT EXISTS tnsatbeltnd_global_messages (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tnsatbeltnd_global_message_reads (
    id VARCHAR(64) PRIMARY KEY,
    message_id VARCHAR(64) NOT NULL,
    reseller_id VARCHAR(64) NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_msg_reseller (message_id, reseller_id),
    FOREIGN KEY (message_id) REFERENCES tnsatbeltnd_global_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES tnsatbeltnd_resellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_gm_active ON tnsatbeltnd_global_messages(is_active);
CREATE INDEX idx_gmr_message ON tnsatbeltnd_global_message_reads(message_id);
CREATE INDEX idx_gmr_reseller ON tnsatbeltnd_global_message_reads(reseller_id);
