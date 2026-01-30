-- CRM: Persist all data in Supabase so it works for everyone on any device.
-- Run after CRM_ORGANIZATIONS_MIGRATION.sql in Supabase SQL Editor.

-- 1) "Other" contacts: store in crm_organizations with contact_type (organization | other).
ALTER TABLE public.crm_organizations ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'organization';
COMMENT ON COLUMN public.crm_organizations.contact_type IS 'CRM contact type: organization or other.';

-- 2) Custom field definitions: shared for all admins (not per-browser localStorage).
CREATE TABLE IF NOT EXISTS public.crm_custom_field_definitions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  applicable_types JSONB NOT NULL DEFAULT '["hospital"]',
  field_type TEXT NOT NULL DEFAULT 'short_answer',
  options JSONB DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.crm_custom_field_definitions IS 'Admin CRM custom field definitions. Shared across all users.';

ALTER TABLE public.crm_custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/Managers view crm_custom_field_definitions" ON public.crm_custom_field_definitions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager'))
  );

CREATE POLICY "Admins/Managers manage crm_custom_field_definitions" ON public.crm_custom_field_definitions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager'))
  );

-- 3) Hospital CRM status (Active/Inactive/Pending) so bulk status and edits persist.
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS crm_status TEXT DEFAULT 'Active';
COMMENT ON COLUMN public.hospitals.crm_status IS 'CRM display status: Active, Inactive, Pending.';
