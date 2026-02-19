-- Complete migration for site_checklist_progress with all prerequisites
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create update_updated_at function if it doesn't exist
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 2: Create mentor_hospital_assignments table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS public.mentor_hospital_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID NOT NULL REFERENCES public.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(mentor_id, hospital_id)
);

-- Enable RLS
ALTER TABLE public.mentor_hospital_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Mentors view own assignments" ON public.mentor_hospital_assignments;
DROP POLICY IF EXISTS "Admins/Managers manage assignments" ON public.mentor_hospital_assignments;

-- Create RLS policies for mentor_hospital_assignments
CREATE POLICY "Mentors view own assignments" ON public.mentor_hospital_assignments
  FOR SELECT USING (mentor_id = auth.uid());

CREATE POLICY "Admins/Managers manage assignments" ON public.mentor_hospital_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- ============================================
-- STEP 3: Create site_members table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users view own site memberships" ON public.site_members;
DROP POLICY IF EXISTS "Admins manage site memberships" ON public.site_members;

-- Create RLS policies for site_members
CREATE POLICY "Users view own site memberships" ON public.site_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins manage site memberships" ON public.site_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- ============================================
-- STEP 4: Create site_checklist_progress table
-- ============================================
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "PECC manage own site checklist" ON public.site_checklist_progress;
DROP POLICY IF EXISTS "Mentor manage assigned hospitals checklist" ON public.site_checklist_progress;
DROP POLICY IF EXISTS "Admin Manager manage all checklist" ON public.site_checklist_progress;

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

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_site_checklist_progress_updated_at ON public.site_checklist_progress;

CREATE TRIGGER update_site_checklist_progress_updated_at
  BEFORE UPDATE ON public.site_checklist_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Tables created: mentor_hospital_assignments, site_members, site_checklist_progress';
END $$;
