-- Migration 025: Switch platform to TND-only (no more "credits" concept)
-- DB column names are kept unchanged for back-compat. Values now represent TND directly.
-- Resets all balances, all product prices, and clears the ledger so admin can re-enter
-- everything in TND from scratch.
--
-- ⚠️ DESTRUCTIVE: balances, prices, transactions and recharge codes are wiped.

START TRANSACTION;

-- Zero all balances
UPDATE tnsatbeltnd_clients   SET credits = 0;
UPDATE tnsatbeltnd_resellers SET credits = 0;

-- Zero all product prices (admin will re-enter in TND)
UPDATE tnsatbeltnd_services SET price_credits = 0, price_tnd = 0;

-- Wipe per-reseller price overrides
DELETE FROM tnsatbeltnd_reseller_service_prices;

-- Clear ledger and unused vouchers (already-redeemed codes kept for audit reference)
DELETE FROM tnsatbeltnd_point_transactions;
DELETE FROM tnsatbeltnd_recharge_codes WHERE is_used = 0;

-- Drop the conversion-rate setting (no longer used; 1 unit = 1 TND now)
DELETE FROM tnsatbeltnd_settings WHERE setting_key = 'credits_per_tnd';

COMMIT;
