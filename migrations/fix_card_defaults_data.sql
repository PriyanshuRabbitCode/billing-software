-- Migration: Fix card defaults data and add proper constraints
-- This migration cleans up existing invalid data and adds proper constraints

-- First, clean up existing invalid POS type data
-- Set invalid POS types to NULL since they don't match our allowed values
UPDATE card_details 
SET default_pos_type = NULL 
WHERE default_pos_type NOT IN ('MP', 'PH', 'MOS') 
   OR default_pos_type IS NOT NULL;

-- Now add the proper constraint for default_pos_type
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
        RAISE NOTICE 'Added check_default_pos_type constraint';
    ELSE
        RAISE NOTICE 'check_default_pos_type constraint already exists';
    END IF;
END $$;

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'card_details'::regclass
AND conname = 'check_default_pos_type';
