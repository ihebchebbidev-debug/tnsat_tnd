-- Migration 003: Rename points to credits and change INT to DECIMAL(10,2)
-- Supports fractional credits (e.g., 0.3 credits for a test)

-- Clients: points → credits
ALTER TABLE tnsatbeltnd_clients CHANGE COLUMN points credits DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Resellers: points → credits
ALTER TABLE tnsatbeltnd_resellers CHANGE COLUMN points credits DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Services: price_points → price_credits
ALTER TABLE tnsatbeltnd_services CHANGE COLUMN price_points price_credits DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Orders: points_used → credits_used
ALTER TABLE tnsatbeltnd_orders CHANGE COLUMN points_used credits_used DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Point Transactions → Credit Transactions: amount & balance_after to DECIMAL
ALTER TABLE tnsatbeltnd_point_transactions MODIFY COLUMN amount DECIMAL(10,2) NOT NULL;
ALTER TABLE tnsatbeltnd_point_transactions MODIFY COLUMN balance_after DECIMAL(10,2) NOT NULL;
