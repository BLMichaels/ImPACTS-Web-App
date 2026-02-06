-- CRM Custom Fields RLS Fix
-- Run this in your Supabase SQL Editor to fix custom field definitions access
-- This also fixes custom fields for ALL contact types

-- =====================================================
-- 1. Create helper function if not exists
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_user_id 
    AND (role = 'admin' OR is_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. Ensure crm_custom_field_definitions table exists
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crm_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  applicable_types TEXT[] DEFAULT ARRAY['hospital']::TEXT[],
  field_type TEXT NOT NULL DEFAULT 'short_answer',
  options TEXT[] DEFAULT ARRAY[]::TEXT[],
  sort_order INTEGER DEFAULT 0,
  allow_multiple BOOLEAN DEFAULT false,  -- If true, allows multiple dated entries (like a log)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add allow_multiple column if table already exists
ALTER TABLE public.crm_custom_field_definitions 
ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN DEFAULT false;

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_crm_custom_field_definitions_sort 
ON public.crm_custom_field_definitions(sort_order);

-- =====================================================
-- 3. Enable RLS and fix policies
-- =====================================================

ALTER TABLE public.crm_custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Drop old policies that may be causing issues
DROP POLICY IF EXISTS "Admins full access to crm_custom_field_definitions" ON public.crm_custom_field_definitions;
DROP POLICY IF EXISTS "Authenticated users read crm_custom_field_definitions" ON public.crm_custom_field_definitions;
DROP POLICY IF EXISTS "crm_custom_fields_admin_all" ON public.crm_custom_field_definitions;
DROP POLICY IF EXISTS "crm_custom_fields_read" ON public.crm_custom_field_definitions;

-- Admins can do everything (with proper WITH CHECK for inserts)
CREATE POLICY "crm_custom_fields_admin_all" ON public.crm_custom_field_definitions
  FOR ALL 
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- All authenticated users can read (for displaying fields in the UI)
CREATE POLICY "crm_custom_fields_read" ON public.crm_custom_field_definitions
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 4. Grant permissions
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_custom_field_definitions TO authenticated;

-- =====================================================
-- 5. Refresh schema cache
-- =====================================================

NOTIFY pgrst, 'reload schema';

-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT * FROM public.crm_custom_field_definitions;
