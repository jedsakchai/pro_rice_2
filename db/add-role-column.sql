-- Add role column to owners table (safe migration for existing DB)
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS role ENUM('villager','owner') NOT NULL DEFAULT 'villager'
  AFTER mill_id;

-- Set existing owners who have a mill_id to 'owner' role
UPDATE owners SET role = 'owner' WHERE mill_id IS NOT NULL AND role = 'villager';
