-- Fix shared checklist progress access + realtime for mentor/PECC bidirectional sync.
-- PECCs often store hospitals.facility_id (e.g. 50137) while progress rows use hospitals.id (UUID).

BEGIN;

-- Unified access: resolves facility_id refs and mentor assignments (see HOSPITAL_DATA_RLS_POLICIES.sql).
DROP POLICY IF EXISTS "PECC manage own site checklist" ON public.site_checklist_progress;
DROP POLICY IF EXISTS "Mentor manage assigned hospitals checklist" ON public.site_checklist_progress;
DROP POLICY IF EXISTS "Admin Manager manage all checklist" ON public.site_checklist_progress;

CREATE POLICY "site_checklist_progress_select"
  ON public.site_checklist_progress
  FOR SELECT
  TO authenticated
  USING (public.can_access_hospital_data(hospital_id));

CREATE POLICY "site_checklist_progress_insert"
  ON public.site_checklist_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_hospital_data(hospital_id));

CREATE POLICY "site_checklist_progress_update"
  ON public.site_checklist_progress
  FOR UPDATE
  TO authenticated
  USING (public.can_access_hospital_data(hospital_id))
  WITH CHECK (public.can_access_hospital_data(hospital_id));

CREATE POLICY "site_checklist_progress_delete"
  ON public.site_checklist_progress
  FOR DELETE
  TO authenticated
  USING (public.can_access_hospital_data(hospital_id));

-- Realtime: required for live mentor <-> PECC checkbox sync in the app.
ALTER TABLE public.site_checklist_progress REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'site_checklist_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_checklist_progress;
  END IF;
END $$;

COMMIT;
