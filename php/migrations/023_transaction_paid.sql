-- Adds an explicit paid/unpaid flag to credit transactions.
-- Admin can mark credit additions as "payé par reseller" or revert.

ALTER TABLE tnsatbeltnd_point_transactions
  ADD COLUMN is_paid TINYINT(1) NOT NULL DEFAULT 0;

-- Backfill: any existing credit transaction whose description mentions
-- "payé par reseller" should be considered paid.
UPDATE tnsatbeltnd_point_transactions
SET is_paid = 1
WHERE type = 'credit'
  AND description LIKE '%payé par reseller%';
