-- ============================================================
-- 016: Add optional image_url to global messages
-- ============================================================

ALTER TABLE tnsatbeltnd_global_messages
    ADD COLUMN image_url VARCHAR(500) NULL AFTER message;
