-- PostgreSQL schema for Billing System (local dev)

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    billing_address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    pin_code VARCHAR(10),
    email_id VARCHAR(100),
    contact_no VARCHAR(15),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Tax Details
CREATE TABLE IF NOT EXISTS public.customer_tax_details (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    pan_no VARCHAR(20),
    aadhaar_no VARCHAR(20)
);

-- Card Details
CREATE TABLE IF NOT EXISTS public.card_details (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    bank_name VARCHAR(100),
    card_type VARCHAR(50),
    card_name VARCHAR(100),
    card_number VARCHAR(20) UNIQUE,
    due_date DATE
);

-- Identity Documents
CREATE TABLE IF NOT EXISTS public.identity_documents (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    document_type VARCHAR(50),
    document_number VARCHAR(50),
    document_image TEXT
);

-- Accounts
CREATE TABLE IF NOT EXISTS public.accounts (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    credit_allowed BOOLEAN DEFAULT TRUE,
    credit_limit DECIMAL(10,2),
    price_category VARCHAR(50),
    remark TEXT,
    received DECIMAL(10,2),
    pending_amount DECIMAL(10,2)
);

-- Transactions (Updated for new form fields)
CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    card_number VARCHAR(20) REFERENCES public.card_details(card_number),
    card_name VARCHAR(100),
    
    -- Amount fields
    deposit_amount DECIMAL(10,2) DEFAULT 0.00,
    withdraw_amount DECIMAL(10,2) DEFAULT 0.00,
    payable_amount DECIMAL(10,2) DEFAULT 0.00,
    
    -- Tax and charges
    pos_type VARCHAR(10) CHECK (pos_type IN ('MP', 'PH', 'MOS')),
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    mdr_amount DECIMAL(5,2) DEFAULT 0.00,
    mdr_charge_amount DECIMAL(10,2) DEFAULT 0.00,
    profit_amount DECIMAL(10,2) DEFAULT 0.00,
    
    -- Logic flags
    add_tax_to_withdraw BOOLEAN DEFAULT FALSE,
    
    -- Calculated fields
    pending_amount DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'PAID', 'Overpaid')),
    
    -- Metadata
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Credits
CREATE TABLE IF NOT EXISTS public.customer_credits (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('credit_given', 'repayment')) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    note TEXT
);

-- Payment Alerts
CREATE TABLE IF NOT EXISTS public.payment_alerts (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    alert_message TEXT,
    due_date DATE,
    is_paid BOOLEAN DEFAULT FALSE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_number ON public.transactions(card_number);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_card_details_customer_id ON public.card_details(customer_id);
CREATE INDEX IF NOT EXISTS idx_card_details_card_number ON public.card_details(card_number);





