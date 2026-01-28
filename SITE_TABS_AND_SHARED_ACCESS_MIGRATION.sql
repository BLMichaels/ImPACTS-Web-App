-- Site-centric PECC page: tab visibility and shared access per hospital/site.
-- Run in Supabase SQL Editor. Requires public.users and public.hospitals.
-- If users.hospital_facility_id is missing, run REGISTRATION_QUESTIONS_MIGRATION.sql first, or:
--   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hospital_facility_id TEXT;
-- site_id = hospital.facility_id when present, else hospital.id::text (same as CRM contact id).

-- ============================================
-- SITE TAB VISIBILITY (which tabs PECCs see for a given site)
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_tab_visibility (
  site_id TEXT NOT NULL,
  tab_key TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (site_id, tab_key)
);

COMMENT ON TABLE public.site_tab_visibility IS 'Per-site visibility of PECC nav tabs (activities, snapshot, milestones, etc.). Admins/Managers/Mentors set in CRM.';
COMMENT ON COLUMN public.site_tab_visibility.site_id IS 'Hospital/site id: hospitals.facility_id or hospitals.id::text (matches CRM contact id).';
COMMENT ON COLUMN public.site_tab_visibility.tab_key IS 'Tab key: activities, snapshot, milestones, education, gap-plan, simulation.';

ALTER TABLE public.site_tab_visibility ENABLE ROW LEVEL SECURITY;

-- Admins/Managers/Mentors can manage
CREATE POLICY "Admins/managers/mentors manage site_tab_visibility"
  ON public.site_tab_visibility FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager', 'mentor')
    )
  );

-- PECCs can read their own site's visibility (site_id = users.hospital_facility_id or they are in site_members)
CREATE POLICY "PECCs read own site tab visibility"
  ON public.site_tab_visibility FOR SELECT
  USING (
    site_id = (SELECT hospital_facility_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.site_members sm WHERE sm.site_id = site_tab_visibility.site_id AND sm.user_id = auth.uid())
  );

-- ============================================
-- SITE MEMBERS (users who share access to one site/hospital page)
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_members (
  site_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (site_id, user_id)
);

COMMENT ON TABLE public.site_members IS 'Users who have access to a site (hospital) PECC page. Multiple people can share one page; activities are attributed via submitted_by.';
COMMENT ON COLUMN public.site_members.site_id IS 'Hospital/site id, same as site_tab_visibility.site_id.';

CREATE INDEX IF NOT EXISTS idx_site_members_user_id ON public.site_members(user_id);
CREATE INDEX IF NOT EXISTS idx_site_members_site_id ON public.site_members(site_id);

ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;

-- Admins/Managers/Mentors can manage
CREATE POLICY "Admins/managers/mentors manage site_members"
  ON public.site_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager', 'mentor')
    )
  );

-- Users can read their own memberships
CREATE POLICY "Users read own site memberships"
  ON public.site_members FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- PECC ACTIVITIES: add submitted_by for attribution when multiple people share a site
-- ============================================
ALTER TABLE public.pecc_activities ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id);
COMMENT ON COLUMN public.pecc_activities.submitted_by IS 'User who submitted this activity (for shared-site attribution; defaults to pecc_id if null).';
