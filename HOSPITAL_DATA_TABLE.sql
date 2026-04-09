-- Hospital-owned JSON storage for PECC continuity.
-- Run in Supabase SQL editor.
-- Purpose: preserve operational PECC data at hospital level across PECC user turnover.

BEGIN;

CREATE TABLE IF NOT EXISTS public.hospital_data (
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  data_key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id),
  PRIMARY KEY (hospital_id, data_key)
);

COMMENT ON TABLE public.hospital_data IS
  'Hospital-owned JSON blobs keyed by data_key (activities, gapPlans, milestones, simulation data, readiness data).';

COMMENT ON COLUMN public.hospital_data.updated_by IS
  'Authenticated user who last modified this key (attribution/audit).';

CREATE INDEX IF NOT EXISTS idx_hospital_data_hospital_id ON public.hospital_data(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_data_data_key ON public.hospital_data(data_key);
CREATE INDEX IF NOT EXISTS idx_hospital_data_updated_at ON public.hospital_data(updated_at DESC);

ALTER TABLE public.hospital_data ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_data TO authenticated;

COMMIT;
