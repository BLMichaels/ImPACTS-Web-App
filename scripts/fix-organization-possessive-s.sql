-- Fix "Company/Parent Organization" and any organization-style names:
-- Replace apostrophe + capital S with apostrophe + lowercase s
-- e.g. "Brigham And Women'S Hospital, Boston, MA" -> "Brigham And Women's Hospital, Boston, MA"
-- Run in Supabase: SQL Editor → New query → paste → Run.

-- ============================================================
-- 1. HOSPITALS: hospital_system (main "Company/Parent Organization" in CRM)
-- ============================================================
-- Straight apostrophe (')
UPDATE public.hospitals
SET hospital_system = REPLACE(hospital_system, '''S', '''s')
WHERE hospital_system IS NOT NULL AND hospital_system LIKE '%''S%';

-- Curly apostrophe (') — Unicode U+2019
UPDATE public.hospitals
SET hospital_system = REPLACE(hospital_system, CHR(8217) || 'S', CHR(8217) || 's')
WHERE hospital_system IS NOT NULL AND hospital_system LIKE '%' || CHR(8217) || 'S%';

-- ============================================================
-- 2. HOSPITALS: company_name (only if column exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hospitals' AND column_name = 'company_name') THEN
    UPDATE public.hospitals SET company_name = REPLACE(company_name, '''S', '''s') WHERE company_name IS NOT NULL AND company_name LIKE '%''S%';
    UPDATE public.hospitals SET company_name = REPLACE(company_name, CHR(8217) || 'S', CHR(8217) || 's') WHERE company_name IS NOT NULL AND company_name LIKE '%' || CHR(8217) || 'S%';
  END IF;
END $$;

-- ============================================================
-- 3. CRM_ORGANIZATIONS: name and organization columns
-- ============================================================
-- name
UPDATE public.crm_organizations
SET name = REPLACE(name, '''S', '''s')
WHERE name LIKE '%''S%';

UPDATE public.crm_organizations
SET name = REPLACE(name, CHR(8217) || 'S', CHR(8217) || 's')
WHERE name LIKE '%' || CHR(8217) || 'S%';

-- organization (the org a person belongs to; only if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'crm_organizations' AND column_name = 'organization') THEN
    UPDATE public.crm_organizations SET organization = REPLACE(organization, '''S', '''s') WHERE organization IS NOT NULL AND organization LIKE '%''S%';
    UPDATE public.crm_organizations SET organization = REPLACE(organization, CHR(8217) || 'S', CHR(8217) || 's') WHERE organization IS NOT NULL AND organization LIKE '%' || CHR(8217) || 'S%';
  END IF;
END $$;
