-- Enable and enforce RLS on migration/backfill log tables exposed via PostgREST.
-- Addresses Supabase linter finding: rls_disabled_in_public (0013).

ALTER TABLE IF EXISTS public.hospital_data_migration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pecc_hospital_facility_backfill_log ENABLE ROW LEVEL SECURITY;

-- Force RLS so even table owners do not bypass policies accidentally.
ALTER TABLE IF EXISTS public.hospital_data_migration_log FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pecc_hospital_facility_backfill_log FORCE ROW LEVEL SECURITY;

-- Admin-read only policies.
DROP POLICY IF EXISTS hospital_data_migration_log_admin_read ON public.hospital_data_migration_log;
CREATE POLICY hospital_data_migration_log_admin_read
ON public.hospital_data_migration_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR COALESCE(u.is_admin, false))
  )
);

DROP POLICY IF EXISTS pecc_hospital_facility_backfill_log_admin_read ON public.pecc_hospital_facility_backfill_log;
CREATE POLICY pecc_hospital_facility_backfill_log_admin_read
ON public.pecc_hospital_facility_backfill_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR COALESCE(u.is_admin, false))
  )
);
