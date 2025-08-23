-- Migration to remove opening_balance column from accounts table

-- Remove opening_balance column from accounts table
ALTER TABLE public.accounts DROP COLUMN IF EXISTS opening_balance;
