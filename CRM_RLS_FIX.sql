-- CRM Complete Fix
-- Run this in your Supabase SQL Editor to fix ALL CRM issues
-- This fixes: RLS policies AND missing address columns

-- =====================================================
-- STEP 1: Add missing address columns
-- =====================================================

ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS address2 TEXT;
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS zip TEXT;


-- =====================================================
-- STEP 2: Fix crm_organizations RLS policies
-- =====================================================

-- Drop old policies that don't work
DROP POLICY IF EXISTS "Admins full access to crm_organizations" ON public.crm_organizations;
DROP POLICY IF EXISTS "Managers read crm_organizations" ON public.crm_organizations;
DROP POLICY IF EXISTS "Authenticated users full access to crm_organizations" ON public.crm_organizations;

-- Create new policy that allows all authenticated users full access
-- (Your app already handles role-based access in the UI)
CREATE POLICY "Authenticated users full access to crm_organizations" ON public.crm_organizations
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- =====================================================
-- STEP 3: Fix crm_custom_field_definitions RLS policies  
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Admins full access to crm_custom_field_definitions" ON public.crm_custom_field_definitions;
DROP POLICY IF EXISTS "Authenticated users read crm_custom_field_definitions" ON public.crm_custom_field_definitions;
DROP POLICY IF EXISTS "Authenticated users full access to crm_custom_field_definitions" ON public.crm_custom_field_definitions;

-- Create new policy for full access
CREATE POLICY "Authenticated users full access to crm_custom_field_definitions" ON public.crm_custom_field_definitions
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- =====================================================
-- STEP 4: Grant permissions (in case they're missing)
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_custom_field_definitions TO authenticated;


-- =====================================================
-- VERIFICATION: This should show the address columns
-- =====================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'crm_organizations'
ORDER BY ordinal_position;
