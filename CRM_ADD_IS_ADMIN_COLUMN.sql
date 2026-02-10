-- CRM: Add is_admin column to crm_organizations
-- Run this in your Supabase SQL Editor
-- This adds the is_admin column to track if a person is an admin

-- Add is_admin column to crm_organizations if it doesn't exist
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_crm_organizations_is_admin ON public.crm_organizations(is_admin);

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'crm_organizations'
  AND column_name = 'is_admin';
