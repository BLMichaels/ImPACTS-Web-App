-- CRM: Organizations table so organizations added in Admin CRM are persisted and shown on reload.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.crm_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  region TEXT,
  state TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT,
  notes_log JSONB DEFAULT '[]',
  activity_log JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '{}',
  contact_type TEXT NOT NULL DEFAULT 'organization',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.crm_organizations IS 'Admin CRM organizations (non-hospital). Persisted so they show after page refresh.';

CREATE INDEX IF NOT EXISTS idx_crm_organizations_name ON public.crm_organizations(name);
CREATE INDEX IF NOT EXISTS idx_crm_organizations_region ON public.crm_organizations(region);
CREATE INDEX IF NOT EXISTS idx_crm_organizations_state ON public.crm_organizations(state);

ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view and manage organizations.
CREATE POLICY "Admins/Managers view crm_organizations" ON public.crm_organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins/Managers manage crm_organizations" ON public.crm_organizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );
