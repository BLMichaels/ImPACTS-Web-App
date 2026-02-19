-- Shared checklist (PECC Checklist / Mentor Site Milestones) progress per hospital and task.
-- Run in Supabase SQL Editor. Requires: public.hospitals, public.users, public.mentor_hospital_assignments,
-- public.site_members, and the update_updated_at() function (from supabase-schema.sql or prior migration).

CREATE TABLE IF NOT EXISTS public.site_checklist_progress (
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hospital_id, task_id)
);

COMMENT ON TABLE public.site_checklist_progress IS 'Checklist task completion per hospital. Shared by PECC (Checklist tab) and Mentors (Site Milestones). task_id e.g. 1.1, 2.3.';

CREATE INDEX IF NOT EXISTS idx_site_checklist_progress_hospital_id ON public.site_checklist_progress(hospital_id);

ALTER TABLE public.site_checklist_progress ENABLE ROW LEVEL SECURITY;

-- PECC: access rows for their site (hospital_facility_id or site_members)
CREATE POLICY "PECC manage own site checklist"
  ON public.site_checklist_progress FOR ALL
  USING (
    hospital_id::text = (SELECT hospital_facility_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM public.site_members sm
      WHERE sm.user_id = auth.uid() AND sm.site_id = site_checklist_progress.hospital_id::text
    )
  );

-- Mentor: access rows for hospitals they are assigned to
CREATE POLICY "Mentor manage assigned hospitals checklist"
  ON public.site_checklist_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_hospital_assignments mha
      WHERE mha.hospital_id = site_checklist_progress.hospital_id
        AND mha.mentor_id = auth.uid()
        AND mha.is_active = true
    )
  );

-- Admin/Manager: full access
CREATE POLICY "Admin Manager manage all checklist"
  ON public.site_checklist_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

CREATE TRIGGER update_site_checklist_progress_updated_at
  BEFORE UPDATE ON public.site_checklist_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
