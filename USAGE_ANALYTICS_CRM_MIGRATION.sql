-- Usage analytics: link events to hospital for per-site and per-person CRM usage.
-- Run after USAGE_ANALYTICS_MIGRATION.sql. Run in Supabase SQL Editor.

-- Link events to hospital (PECC site / mentor assignment context)
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS hospital_id UUID NULL REFERENCES public.hospitals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_hospital_id ON public.usage_events (hospital_id) WHERE hospital_id IS NOT NULL;

COMMENT ON COLUMN public.usage_events.hospital_id IS 'Hospital (site) when event occurred; used for CRM usage by site.';

-- Allow managers to read usage_events (for CRM usage on their contacts)
DROP POLICY IF EXISTS "Admins read usage events" ON public.usage_events;
CREATE POLICY "Admins read usage events" ON public.usage_events
  FOR SELECT USING (public.current_user_role() IN ('admin', 'manager'));
