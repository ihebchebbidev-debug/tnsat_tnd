-- Add note column to orders table
ALTER TABLE tnsatbeltnd_orders ADD COLUMN note TEXT DEFAULT NULL AFTER credentials;
