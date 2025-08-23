-- Migration: Make customer fields mandatory except remark
-- This migration adds NOT NULL constraints to required fields

-- Make customer fields mandatory
ALTER TABLE customers 
ALTER COLUMN billing_address SET NOT NULL,
ALTER COLUMN city SET NOT NULL,
ALTER COLUMN state SET NOT NULL,
ALTER COLUMN pin_code SET NOT NULL,
ALTER COLUMN email_id SET NOT NULL,
ALTER COLUMN contact_no SET NOT NULL;

-- Make identity document fields mandatory
ALTER TABLE identity_documents 
ALTER COLUMN document_number SET NOT NULL,
ALTER COLUMN document_image SET NOT NULL;

-- Make account fields mandatory (except remark)
ALTER TABLE accounts 
ALTER COLUMN credit_limit SET NOT NULL,
ALTER COLUMN received SET NOT NULL,
ALTER COLUMN pending_amount SET NOT NULL;

-- Add unique constraints for email, PAN, and Aadhaar
ALTER TABLE customers ADD CONSTRAINT unique_email UNIQUE (email_id);
ALTER TABLE customer_tax_details ADD CONSTRAINT unique_pan UNIQUE (pan_no);
ALTER TABLE customer_tax_details ADD CONSTRAINT unique_aadhaar UNIQUE (aadhaar_no);
