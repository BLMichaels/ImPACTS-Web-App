-- CRM Tables Migration
-- Run this in your Supabase SQL Editor to create the missing CRM tables

-- =====================================================
-- 1. Create crm_organizations table
-- =====================================================
-- This table stores organizations and "other" contact types

CREATE TABLE IF NOT EXISTS public.crm_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  first_name TEXT,  -- for person types (manager, mentor, pecc, staff)
  last_name TEXT,   -- for person types
  organization TEXT, -- the organization a person belongs to
  email TEXT,
  phone TEXT,
  region TEXT,
  state TEXT,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  notes_log JSONB DEFAULT '[]'::jsonb,
  activity_log JSONB DEFAULT '[]'::jsonb,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  contact_type TEXT DEFAULT 'organization',  -- 'organization', 'other', 'manager', 'mentor', 'pecc', 'staff'
  linked_organization_ids UUID[] DEFAULT ARRAY[]::UUID[],  -- organizations this person is linked to
  linked_hospital_ids UUID[] DEFAULT ARRAY[]::UUID[],      -- hospitals this person is linked to
  address TEXT,     -- Address Line 1
  address2 TEXT,    -- Address Line 2 (apt, suite, etc.)
  city TEXT,
  county TEXT,
  zip TEXT,         -- Zip/Postal Code
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_crm_organizations_status ON public.crm_organizations(status);
CREATE INDEX IF NOT EXISTS idx_crm_organizations_contact_type ON public.crm_organizations(contact_type);
CREATE INDEX IF NOT EXISTS idx_crm_organizations_name ON public.crm_organizations(name);

-- Enable Row Level Security
ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can do everything
DROP POLICY IF EXISTS "Admins full access to crm_organizations" ON public.crm_organizations;
CREATE POLICY "Admins full access to crm_organizations" ON public.crm_organizations
  FOR ALL USING (public.current_user_role() = 'admin');

-- RLS Policy: Managers can read
DROP POLICY IF EXISTS "Managers read crm_organizations" ON public.crm_organizations;
CREATE POLICY "Managers read crm_organizations" ON public.crm_organizations
  FOR SELECT USING (public.current_user_role() = 'manager');


-- =====================================================
-- 2. Create crm_custom_field_definitions table
-- =====================================================
-- This table stores custom field definitions for CRM contacts

CREATE TABLE IF NOT EXISTS public.crm_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  applicable_types TEXT[] DEFAULT ARRAY['hospital']::TEXT[],  -- which contact types this field applies to
  field_type TEXT NOT NULL DEFAULT 'text',  -- 'text', 'number', 'date', 'select', 'multiselect', 'boolean'
  options TEXT[] DEFAULT ARRAY[]::TEXT[],  -- for select/multiselect fields
  allow_multiple BOOLEAN DEFAULT false,  -- if true, allows multiple dated entries (like a log of phone calls)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add allow_multiple column if table already exists
ALTER TABLE public.crm_custom_field_definitions 
ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN DEFAULT false;

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_crm_custom_field_definitions_sort ON public.crm_custom_field_definitions(sort_order);

-- Enable Row Level Security
ALTER TABLE public.crm_custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can do everything
DROP POLICY IF EXISTS "Admins full access to crm_custom_field_definitions" ON public.crm_custom_field_definitions;
CREATE POLICY "Admins full access to crm_custom_field_definitions" ON public.crm_custom_field_definitions
  FOR ALL USING (public.current_user_role() = 'admin');

-- RLS Policy: All authenticated users can read (for displaying fields)
DROP POLICY IF EXISTS "Authenticated users read crm_custom_field_definitions" ON public.crm_custom_field_definitions;
CREATE POLICY "Authenticated users read crm_custom_field_definitions" ON public.crm_custom_field_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- =====================================================
-- 3. Add custom_fields column to hospitals table if missing
-- =====================================================
-- This allows custom fields to be stored on hospital records too

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'hospitals' 
    AND column_name = 'custom_fields'
  ) THEN
    ALTER TABLE public.hospitals ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;


-- =====================================================
-- 4. Add notes_log and activity_log to hospitals if missing
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'hospitals' 
    AND column_name = 'notes_log'
  ) THEN
    ALTER TABLE public.hospitals ADD COLUMN notes_log JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'hospitals' 
    AND column_name = 'activity_log'
  ) THEN
    ALTER TABLE public.hospitals ADD COLUMN activity_log JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;


-- =====================================================
-- 5. Grant permissions to authenticated users
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_custom_field_definitions TO authenticated;


-- =====================================================
-- 6. Add address columns to crm_organizations if missing
-- =====================================================
-- Run this if the table already exists without address columns

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'crm_organizations' 
    AND column_name = 'address'
  ) THEN
    ALTER TABLE public.crm_organizations ADD COLUMN address TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'crm_organizations' 
    AND column_name = 'address2'
  ) THEN
    ALTER TABLE public.crm_organizations ADD COLUMN address2 TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'crm_organizations' 
    AND column_name = 'city'
  ) THEN
    ALTER TABLE public.crm_organizations ADD COLUMN city TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'crm_organizations' 
    AND column_name = 'county'
  ) THEN
    ALTER TABLE public.crm_organizations ADD COLUMN county TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'crm_organizations' 
    AND column_name = 'zip'
  ) THEN
    ALTER TABLE public.crm_organizations ADD COLUMN zip TEXT;
  END IF;
END $$;


-- =====================================================
-- VERIFICATION: Run these to confirm tables exist
-- =====================================================
-- SELECT * FROM public.crm_organizations LIMIT 1;
-- SELECT * FROM public.crm_custom_field_definitions LIMIT 1;
