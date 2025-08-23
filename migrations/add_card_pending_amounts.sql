-- Create card_pending_amounts table to track pending amounts per card
CREATE TABLE IF NOT EXISTS public.card_pending_amounts (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    card_number VARCHAR(20) NOT NULL,
    card_name VARCHAR(100),
    pending_amount DECIMAL(10,2) DEFAULT 0.00,
    received_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, card_number)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_card_pending_amounts_card_number ON public.card_pending_amounts(card_number);
CREATE INDEX IF NOT EXISTS idx_card_pending_amounts_customer_id ON public.card_pending_amounts(customer_id);
