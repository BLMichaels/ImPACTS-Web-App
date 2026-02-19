-- Which mentors can invite PECCs to which cohorts.
-- Admins assign per cohort: "Mentors who can invite to this cohort."
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.cohort_invite_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cohort_id, mentor_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_invite_mentors_cohort_id ON public.cohort_invite_mentors(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_invite_mentors_mentor_id ON public.cohort_invite_mentors(mentor_id);

ALTER TABLE public.cohort_invite_mentors ENABLE ROW LEVEL SECURITY;

-- Admins: full access
DROP POLICY IF EXISTS "Admins full access cohort_invite_mentors" ON public.cohort_invite_mentors;
CREATE POLICY "Admins full access cohort_invite_mentors" ON public.cohort_invite_mentors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Managers: can manage for cohorts they manage
DROP POLICY IF EXISTS "Managers manage cohort_invite_mentors" ON public.cohort_invite_mentors;
CREATE POLICY "Managers manage cohort_invite_mentors" ON public.cohort_invite_mentors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cohort_managers cm
      WHERE cm.cohort_id = cohort_invite_mentors.cohort_id AND cm.manager_id = auth.uid()
    )
  );

-- Mentors: can read their own rows (to know which cohorts they can invite to)
DROP POLICY IF EXISTS "Mentors read own cohort_invite_mentors" ON public.cohort_invite_mentors;
CREATE POLICY "Mentors read own cohort_invite_mentors" ON public.cohort_invite_mentors
  FOR SELECT USING (mentor_id = auth.uid());

COMMENT ON TABLE public.cohort_invite_mentors IS 'Which mentors are allowed to invite PECCs to which cohorts. Used to filter cohort options in invite dialogs.';
