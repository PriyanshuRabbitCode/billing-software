-- Migration: Remove country column from customers table
-- This migration removes the country column that is no longer needed

-- Remove country column from customers table
ALTER TABLE public.customers DROP COLUMN IF EXISTS country;
