-- CRM: Add Missing Address Columns
-- Run this in your Supabase SQL Editor
-- This adds the address columns that the frontend expects

-- Add address columns to crm_organizations if they don't exist
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS address2 TEXT;
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS zip TEXT;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'crm_organizations'
  AND column_name IN ('address', 'address2', 'city', 'county', 'zip');
