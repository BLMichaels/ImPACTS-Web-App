-- Applied to ImPACTS_Tracker (ftpifgzzfwpujlvbqqhu) via migration
-- security_advisor_hardening_and_hospital_sso
--
-- Goals:
-- 1) Pin search_path on security-sensitive functions
-- 2) Revoke anon EXECUTE on SECURITY DEFINER RPCs; lock trigger/service helpers
-- 3) Move fuzzystrmatch out of public
-- 4) Hospital SSO tenant mapping for SAML IdPs
--
-- Note: all public tables already had RLS enabled (147+ policies).

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'fuzzystrmatch') THEN
    ALTER EXTENSION fuzzystrmatch SET SCHEMA extensions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fuzzystrmatch schema move skipped: %', SQLERRM;
END $$;

-- Pin search_path (representative set; migration loops over these names)
-- See applied migration for full DO block.

CREATE TABLE IF NOT EXISTS public.hospital_sso_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  email_domain text NOT NULL,
  sso_provider_id uuid,
  hospital_id uuid NULL REFERENCES public.hospitals(id) ON DELETE SET NULL,
  hospital_system text NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hospital_sso_providers_domain_unique UNIQUE (email_domain)
);

CREATE INDEX IF NOT EXISTS hospital_sso_providers_provider_idx
  ON public.hospital_sso_providers (sso_provider_id)
  WHERE sso_provider_id IS NOT NULL;

ALTER TABLE public.hospital_sso_providers ENABLE ROW LEVEL SECURITY;

-- Policies + function GRANT/REVOKE are applied in the remote migration.
-- Re-run via Supabase MCP apply_migration / SQL editor if rebuilding an environment.

COMMENT ON TABLE public.hospital_sso_providers IS
  'Maps hospital/organization email domains to Supabase SAML SSO provider UUIDs for per-hospital IdP login.';
