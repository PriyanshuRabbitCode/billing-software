-- Down Migration: Restore deprecated columns for rollback
-- Adds columns back as nullable to avoid data issues; original types assumed

BEGIN;

-- Customers: restore 'country' column
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS country TEXT;

-- Customer Tax Details: restore 'gst_type' column
ALTER TABLE IF EXISTS customer_tax_details ADD COLUMN IF NOT EXISTS gst_type TEXT;

-- Cards: restore due_date/card_due_date columns
ALTER TABLE IF EXISTS cards ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE IF EXISTS cards ADD COLUMN IF NOT EXISTS card_due_date DATE;

COMMIT;