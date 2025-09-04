-- Migration: Add card default fields
-- This migration adds the missing fields needed for card-specific POS/Tax/MDR defaults

-- Add the missing fields to card_details table (without constraints initially)
ALTER TABLE card_details 
ADD COLUMN IF NOT EXISTS enable_defaults BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS default_pos_type VARCHAR(10),
ADD COLUMN IF NOT EXISTS default_tax_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS default_mdr_rate DECIMAL(5,2);

-- Add constraint for default_pos_type to match the transactions table constraint
-- Only add if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_default_pos_type' 
        AND conrelid = 'card_details'::regclass
    ) THEN
        ALTER TABLE card_details 
        ADD CONSTRAINT check_default_pos_type 
        CHECK (default_pos_type IS NULL OR default_pos_type IN ('MP', 'PH', 'MOS'));
    END IF;
END $$;

-- Add constraint for tax rate and MDR rate to be positive
-- Only add if they don't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_default_tax_rate' 
        AND conrelid = 'card_details'::regclass
    ) THEN
        ALTER TABLE card_details 
        ADD CONSTRAINT check_default_tax_rate 
        CHECK (default_tax_rate IS NULL OR default_tax_rate >= 0);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_default_mdr_rate' 
        AND conrelid = 'card_details'::regclass
    ) THEN
        ALTER TABLE card_details 
        ADD CONSTRAINT check_default_mdr_rate 
        CHECK (default_mdr_rate IS NULL OR default_mdr_rate >= 0);
    END IF;
END $$;

-- Add comment to document the new fields
COMMENT ON COLUMN card_details.enable_defaults IS 'Whether to use default POS/Tax/MDR values for this card';
COMMENT ON COLUMN card_details.default_pos_type IS 'Default POS type (MP, PH, MOS) for transactions with this card';
COMMENT ON COLUMN card_details.default_tax_rate IS 'Default tax rate percentage for transactions with this card';
COMMENT ON COLUMN card_details.default_mdr_rate IS 'Default MDR rate percentage for transactions with this card';
