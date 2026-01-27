-- Add columns to public.hospitals so import-hospitals.js can upsert All Hospitals.csv
-- Run this in Supabase SQL Editor if your hospitals table was created from supabase-schema.sql
-- and you want to use the CSV import. After running, use: node import-hospitals.js "/path/to/All Hospitals.csv"

-- Add import-style columns (idempotent)
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS facility_id TEXT UNIQUE;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS hospital_type TEXT;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS ownership TEXT;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS has_emergency_services BOOLEAN;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS birthing_friendly TEXT;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS overall_rating TEXT;

-- Ensure everyone can read active hospitals (Admin CRM loads from here)
-- If you already have "View active hospitals", this is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hospitals' AND policyname = 'View active hospitals'
  ) THEN
    CREATE POLICY "View active hospitals" ON public.hospitals FOR SELECT USING (is_active = true);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
