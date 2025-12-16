-- Up Migration: Remove deprecated columns no longer used by application code
-- Safe operations using IF EXISTS to avoid failures if columns were already removed

BEGIN;

-- Customers: drop deprecated 'country' column (UI already removed)
ALTER TABLE IF EXISTS customers DROP COLUMN IF EXISTS country;

-- Customer Tax Details: drop deprecated 'gst_type' column (UI already removed)
ALTER TABLE IF EXISTS customer_tax_details DROP COLUMN IF EXISTS gst_type;

-- Cards: drop deprecated due date columns (due date now derived from due_day at read time)
ALTER TABLE IF EXISTS cards DROP COLUMN IF EXISTS due_date;
ALTER TABLE IF EXISTS cards DROP COLUMN IF EXISTS card_due_date;

COMMIT;