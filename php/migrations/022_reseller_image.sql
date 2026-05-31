-- Add profile picture URL to resellers
ALTER TABLE tnsatbeltnd_resellers
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL AFTER currency;