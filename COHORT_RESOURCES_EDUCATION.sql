-- Cohort Resources & Education
-- Section per cohort where Managers and Admins can add resources/education content.
-- All cohort members see it below the Discussion section.

-- =====================================================
-- 1. Create cohort_resources table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cohort_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cohort_resources_cohort_id ON public.cohort_resources(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_resources_sort_order ON public.cohort_resources(cohort_id, sort_order);

ALTER TABLE public.cohort_resources ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.cohort_resources IS 'Resources & education items for a cohort; managers and admins can add/edit/delete; all members can view.';

-- =====================================================
-- 2. RLS policies (mirror cohort_announcements)
-- =====================================================
CREATE POLICY "cohort_resources_admin_all" ON public.cohort_resources
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "cohort_resources_manager_all" ON public.cohort_resources
  FOR ALL USING (public.is_cohort_manager(cohort_id, auth.uid()));

CREATE POLICY "cohort_resources_member_select" ON public.cohort_resources
  FOR SELECT USING (public.is_cohort_member(cohort_id, auth.uid()));

-- =====================================================
-- 3. Grants
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_resources TO authenticated;
