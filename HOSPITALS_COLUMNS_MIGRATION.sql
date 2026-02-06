-- Hospitals Table Column Migration
-- Run this in your Supabase SQL Editor to add missing CRM columns to hospitals table

-- =====================================================
-- 1. Add missing columns to hospitals table
-- =====================================================

-- CRM Status column
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS crm_status TEXT DEFAULT 'Active';

-- Hospital System (parent organization)
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS hospital_system TEXT;

-- Company name (alias for organization)
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Programs array
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS programs TEXT[] DEFAULT '{}';

-- Cohorts array
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS cohorts TEXT[] DEFAULT '{}';

-- Notes (simple text)
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Notes log (JSON array for timestamped notes)
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS notes_log JSONB DEFAULT '[]';

-- Activity log (JSON array for activity tracking)
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]';

-- Custom fields (JSON object for dynamic fields)
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- County
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS county TEXT;

-- Facility ID (for imported hospitals)
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS facility_id TEXT;

-- Email
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Phone
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS phone TEXT;


-- =====================================================
-- 2. Create index for facility_id if it doesn't exist
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_hospitals_facility_id ON public.hospitals(facility_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_crm_status ON public.hospitals(crm_status);
CREATE INDEX IF NOT EXISTS idx_hospitals_hospital_system ON public.hospitals(hospital_system);


-- =====================================================
-- 3. Refresh schema cache
-- =====================================================

NOTIFY pgrst, 'reload schema';


-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'hospitals';
