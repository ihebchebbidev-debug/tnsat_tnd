-- ============================================================
-- 24. Reseller notes on assigned product keys and on notifications
--     (reset requests). Allows resellers to attach a free-text note
--     to each Historique code row and each Reset Code request.
-- ============================================================

ALTER TABLE tnsatbeltnd_product_keys
    ADD COLUMN reseller_note TEXT DEFAULT NULL AFTER assigned_at;

ALTER TABLE tnsatbeltnd_notifications
    ADD COLUMN reseller_note TEXT DEFAULT NULL AFTER message;
