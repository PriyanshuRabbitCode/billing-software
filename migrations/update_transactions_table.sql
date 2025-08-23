-- Migration to update transactions table for new Add Transactions form
-- Run this migration to update existing database structure

-- First, backup existing data if needed
-- CREATE TABLE transactions_backup AS SELECT * FROM transactions;

-- Drop existing foreign key constraints
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;

-- Add new columns
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS withdraw_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payable_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mdr_amount DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mdr_charge_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS add_tax_to_withdraw BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pending_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Pending';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Update card_details table to add card_number column if it doesn't exist
ALTER TABLE card_details ADD COLUMN IF NOT EXISTS card_number VARCHAR(20);
ALTER TABLE card_details ADD COLUMN IF NOT EXISTS due_date DATE;

-- Add unique constraint to card_number in card_details
ALTER TABLE card_details ADD CONSTRAINT IF NOT EXISTS card_details_card_number_unique UNIQUE (card_number);

-- Add foreign key constraint for card_number in transactions
ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS transactions_card_number_fkey 
    FOREIGN KEY (card_number) REFERENCES card_details(card_number);

-- Add check constraint for status
ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS transactions_status_check 
    CHECK (status IN ('Pending', 'PAID', 'Overpaid'));

-- Add check constraint for pos_type
ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS transactions_pos_type_check 
    CHECK (pos_type IN ('MP', 'PH', 'MOS'));

-- Migrate existing data (if any)
-- Update existing records to set default values for new columns
UPDATE transactions SET 
    deposit_amount = CASE WHEN transaction_type = 'credit' THEN amount ELSE 0.00 END,
    withdraw_amount = CASE WHEN transaction_type = 'debit' THEN amount ELSE 0.00 END,
    payable_amount = CASE WHEN transaction_type = 'debit' THEN amount ELSE 0.00 END,
    tax_amount = COALESCE(tax, 0.00),
    mdr_charge_amount = COALESCE(charges, 0.00),
    profit_amount = COALESCE(profit, 0.00),
    pending_amount = CASE 
        WHEN transaction_type = 'credit' THEN -amount 
        WHEN transaction_type = 'debit' THEN amount 
        ELSE 0.00 
    END,
    status = CASE 
        WHEN transaction_type = 'credit' THEN 'PAID'
        WHEN transaction_type = 'debit' THEN 'Pending'
        ELSE 'Pending'
    END
WHERE deposit_amount = 0.00 AND withdraw_amount = 0.00;

-- Drop old columns that are no longer needed
-- ALTER TABLE transactions DROP COLUMN IF EXISTS account_id;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS transaction_type;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS amount;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS tax;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS charges;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS profit;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_number ON transactions(card_number);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_card_details_customer_id ON card_details(customer_id);
CREATE INDEX IF NOT EXISTS idx_card_details_card_number ON card_details(card_number);

-- Add comment to document the changes
COMMENT ON TABLE transactions IS 'Updated transactions table to support new Add Transactions form with card-specific tracking and tax calculations';
