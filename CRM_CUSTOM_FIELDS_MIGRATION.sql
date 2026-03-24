-- Unified custom fields migration for CRM.
-- Run in Supabase SQL Editor.
-- Covers storage + definitions + visibility flags used by Admin CRM and Manager CRM.

-- 1) Value storage on hospitals and crm_organizations
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.crm_organizations
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hospitals.custom_fields IS
  'CRM custom field values (field id -> string value)';
COMMENT ON COLUMN public.crm_organizations.custom_fields IS
  'CRM custom field values (field id -> string value)';

-- 2) Definitions table
CREATE TABLE IF NOT EXISTS public.crm_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  applicable_types TEXT[] DEFAULT ARRAY['hospital']::TEXT[],
  field_type TEXT NOT NULL DEFAULT 'short_answer',
  options TEXT[] DEFAULT ARRAY[]::TEXT[],
  allow_multiple BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  show_in_crm TEXT DEFAULT 'both',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_custom_field_definitions
  ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN DEFAULT false;
ALTER TABLE public.crm_custom_field_definitions
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.crm_custom_field_definitions
  ADD COLUMN IF NOT EXISTS show_in_crm TEXT DEFAULT 'both';

COMMENT ON COLUMN public.crm_custom_field_definitions.show_in_crm IS
  'Where to show in CRM: both, quick_view_only, full_view_only';

CREATE INDEX IF NOT EXISTS idx_crm_custom_field_definitions_sort
  ON public.crm_custom_field_definitions(sort_order);

-- 3) RLS and grants
ALTER TABLE public.crm_custom_field_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access to crm_custom_field_definitions"
  ON public.crm_custom_field_definitions;
CREATE POLICY "Admins full access to crm_custom_field_definitions"
  ON public.crm_custom_field_definitions
  FOR ALL USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated users read crm_custom_field_definitions"
  ON public.crm_custom_field_definitions;
CREATE POLICY "Authenticated users read crm_custom_field_definitions"
  ON public.crm_custom_field_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.crm_custom_field_definitions TO authenticated;
