-- Migration: Add unique constraints for contact_no and aadhaar_no
-- This migration adds unique constraints to ensure no duplicate contact numbers or aadhaar numbers

-- Add unique constraint for contact_no in customers table
ALTER TABLE customers ADD CONSTRAINT unique_contact_no UNIQUE (contact_no);

-- Add unique constraint for aadhaar_no in customer_tax_details table (if not already exists)
-- Note: This might already exist from previous migration, so we use IF NOT EXISTS pattern
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_aadhaar' 
        AND conrelid = 'customer_tax_details'::regclass
    ) THEN
        ALTER TABLE customer_tax_details ADD CONSTRAINT unique_aadhaar UNIQUE (aadhaar_no);
    END IF;
END $$;

