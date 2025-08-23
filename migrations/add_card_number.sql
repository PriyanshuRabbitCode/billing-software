-- Add card_number column to card_details table
ALTER TABLE public.card_details ADD COLUMN IF NOT EXISTS card_number VARCHAR(20);
