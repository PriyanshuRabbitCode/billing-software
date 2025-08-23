-- Migration to update customer form fields
-- 1. Remove country field from customers table
-- 2. Replace gst_no with aadhaar_no in customer_tax_details table

-- Step 1: Remove country column from customers table
ALTER TABLE public.customers DROP COLUMN IF EXISTS country;

-- Step 2: Add aadhaar_no column to customer_tax_details table
ALTER TABLE public.customer_tax_details ADD COLUMN IF NOT EXISTS aadhaar_no VARCHAR(20);

-- Step 3: Drop gst_no column from customer_tax_details table
ALTER TABLE public.customer_tax_details DROP COLUMN IF EXISTS gst_no;

-- Step 4: Add index on aadhaar_no for better performance
CREATE INDEX IF NOT EXISTS idx_customer_tax_details_aadhaar_no ON public.customer_tax_details(aadhaar_no);

-- Step 5: Add validation constraint for aadhaar_no (12 digits)
ALTER TABLE public.customer_tax_details ADD CONSTRAINT check_aadhaar_no_format 
CHECK (aadhaar_no IS NULL OR aadhaar_no ~ '^[0-9]{12}$');
