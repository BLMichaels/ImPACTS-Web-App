-- Manager tier hardening (run in Supabase SQL Editor).
-- 1) Team-scoped hospitals for managers (primary + secondary supervisors + self assignments)
-- 2) Tighten user_data tab_visibility WITH CHECK
-- 3) Align user_permissions / view_tabs with secondary manager_ids
-- 4) Allow managers to create cohorts (insert cohort + self as cohort_manager)

-- =====================================================
-- Hospitals: replace global manager access
-- =====================================================
DROP POLICY IF EXISTS "hospitals_manager_all" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_manager_team_scoped" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_manager_team_select" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_manager_team_update" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_manager_team_delete" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_manager_insert" ON public.hospitals;

CREATE OR REPLACE FUNCTION public.manager_team_hospital_ids(p_manager_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT mha.hospital_id
  FROM public.mentor_hospital_assignments mha
  WHERE mha.is_active = true
    AND (
      mha.mentor_id = p_manager_id
      OR mha.mentor_id IN (
        SELECT u.id
        FROM public.users u
        WHERE u.role = 'mentor'
          AND u.is_active IS DISTINCT FROM false
          AND (
            u.manager_id = p_manager_id
            OR EXISTS (
              SELECT 1
              FROM public.user_data ud
              WHERE ud.user_id = u.id
                AND ud.data_key = 'mentor_manager_ids'
                AND ud.value ? p_manager_id::text
            )
            OR EXISTS (
              SELECT 1
              FROM public.user_data ud
              WHERE ud.user_id = u.id
                AND ud.data_key = 'mentor_manager_ids'
                AND ud.value @> to_jsonb(ARRAY[p_manager_id::text])
            )
          )
      )
    );
$$;

CREATE POLICY "hospitals_manager_team_select" ON public.hospitals
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
    AND id IN (SELECT public.manager_team_hospital_ids(auth.uid()))
  );

CREATE POLICY "hospitals_manager_team_update" ON public.hospitals
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
    AND id IN (SELECT public.manager_team_hospital_ids(auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
    AND id IN (SELECT public.manager_team_hospital_ids(auth.uid()))
  );

CREATE POLICY "hospitals_manager_team_delete" ON public.hospitals
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
    AND id IN (SELECT public.manager_team_hospital_ids(auth.uid()))
  );

-- Managers may add hospitals (then assign to mentors); reads remain team-scoped.
CREATE POLICY "hospitals_manager_insert" ON public.hospitals
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
  );

-- =====================================================
-- Helper: is target user on this manager's team (primary + secondary + cohort)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_manager_team_user(p_manager_id UUID, p_target_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p_manager_id = p_target_user_id
    OR EXISTS (
      SELECT 1 FROM public.users t
      WHERE t.id = p_target_user_id
        AND (
          (t.role = 'mentor' AND t.manager_id = p_manager_id)
          OR (t.role = 'pecc' AND t.manager_id_for_pecc = p_manager_id)
          OR (
            t.role = 'mentor'
            AND EXISTS (
              SELECT 1 FROM public.user_data ud
              WHERE ud.user_id = t.id
                AND ud.data_key = 'mentor_manager_ids'
                AND (
                  ud.value ? p_manager_id::text
                  OR ud.value @> to_jsonb(ARRAY[p_manager_id::text])
                )
            )
          )
          OR (
            t.role = 'pecc'
            AND EXISTS (
              SELECT 1 FROM public.user_data ud
              WHERE ud.user_id = t.id
                AND ud.data_key = 'pecc_direct_manager_ids'
                AND (
                  ud.value ? p_manager_id::text
                  OR ud.value @> to_jsonb(ARRAY[p_manager_id::text])
                )
            )
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.cohort_managers cm
      JOIN public.cohort_members mem ON mem.cohort_id = cm.cohort_id AND mem.status = 'active'
      WHERE cm.manager_id = p_manager_id
        AND mem.user_id = p_target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.cohort_managers cm
      JOIN public.cohort_managers cm2 ON cm2.cohort_id = cm.cohort_id
      WHERE cm.manager_id = p_manager_id
        AND cm2.manager_id = p_target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.users mentor
      JOIN public.users pecc ON pecc.role = 'pecc' AND pecc.mentor_id = mentor.id
      WHERE mentor.role = 'mentor'
        AND mentor.manager_id = p_manager_id
        AND pecc.id = p_target_user_id
    );
$$;

-- =====================================================
-- Permissions targets: mentors + PECCs under this manager only
-- (no admins, no co-managers, no self, no cohort-only outsiders)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_manager_permissions_target(p_manager_id UUID, p_target_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p_manager_id IS DISTINCT FROM p_target_user_id
    AND EXISTS (
      SELECT 1 FROM public.users t
      WHERE t.id = p_target_user_id
        AND COALESCE(t.is_admin, false) = false
        AND t.role IN ('mentor', 'pecc')
        AND (
          (t.role = 'mentor' AND t.manager_id = p_manager_id)
          OR (
            t.role = 'mentor'
            AND EXISTS (
              SELECT 1 FROM public.user_data ud
              WHERE ud.user_id = t.id
                AND ud.data_key = 'mentor_manager_ids'
                AND (
                  ud.value ? p_manager_id::text
                  OR ud.value @> to_jsonb(ARRAY[p_manager_id::text])
                )
            )
          )
          OR (t.role = 'pecc' AND t.manager_id_for_pecc = p_manager_id)
          OR (
            t.role = 'pecc'
            AND EXISTS (
              SELECT 1 FROM public.user_data ud
              WHERE ud.user_id = t.id
                AND ud.data_key = 'pecc_direct_manager_ids'
                AND (
                  ud.value ? p_manager_id::text
                  OR ud.value @> to_jsonb(ARRAY[p_manager_id::text])
                )
            )
          )
          OR (
            t.role = 'pecc'
            AND EXISTS (
              SELECT 1 FROM public.users mentor
              WHERE mentor.role = 'mentor'
                AND mentor.id = t.mentor_id
                AND (
                  mentor.manager_id = p_manager_id
                  OR EXISTS (
                    SELECT 1 FROM public.user_data ud
                    WHERE ud.user_id = mentor.id
                      AND ud.data_key = 'mentor_manager_ids'
                      AND (
                        ud.value ? p_manager_id::text
                        OR ud.value @> to_jsonb(ARRAY[p_manager_id::text])
                      )
                  )
                )
            )
          )
          OR (
            t.role = 'pecc'
            AND EXISTS (
              SELECT 1
              FROM public.users mentor
              JOIN public.mentor_hospital_assignments mha
                ON mha.mentor_id = mentor.id AND mha.is_active = true
              JOIN public.hospitals h ON h.id = mha.hospital_id
              WHERE mentor.role = 'mentor'
                AND (
                  mentor.manager_id = p_manager_id
                  OR EXISTS (
                    SELECT 1 FROM public.user_data ud
                    WHERE ud.user_id = mentor.id
                      AND ud.data_key = 'mentor_manager_ids'
                      AND (
                        ud.value ? p_manager_id::text
                        OR ud.value @> to_jsonb(ARRAY[p_manager_id::text])
                      )
                  )
                )
                AND t.hospital_facility_id IS NOT NULL
                AND (
                  t.hospital_facility_id::text = h.id::text
                  OR (h.facility_id IS NOT NULL AND t.hospital_facility_id::text = h.facility_id::text)
                )
            )
          )
        )
    );
$$;

-- =====================================================
-- user_data tab_visibility: mirror USING in WITH CHECK
-- =====================================================
DROP POLICY IF EXISTS "user_data_manager_tab_visibility" ON public.user_data;
CREATE POLICY "user_data_manager_tab_visibility" ON public.user_data
  FOR ALL
  USING (
    public.user_data.data_key = 'tab_visibility'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'manager'
        AND public.is_manager_permissions_target(u.id, public.user_data.user_id)
    )
  )
  WITH CHECK (
    public.user_data.data_key = 'tab_visibility'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'manager'
        AND public.is_manager_permissions_target(u.id, public.user_data.user_id)
    )
  );

-- =====================================================
-- user_permissions / view_tabs: mentors + PECCs only (not admins)
-- =====================================================
DROP POLICY IF EXISTS "Managers manage team permissions" ON public.user_permissions;
CREATE POLICY "Managers manage team permissions" ON public.user_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'manager'
        AND public.is_manager_permissions_target(u.id, user_permissions.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'manager'
        AND public.is_manager_permissions_target(u.id, user_permissions.user_id)
    )
  );

DROP POLICY IF EXISTS "Managers manage team tabs" ON public.view_tabs;
CREATE POLICY "Managers manage team tabs" ON public.view_tabs
  FOR ALL
  USING (
    (
      view_tabs.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'manager'
          AND public.is_manager_permissions_target(u.id, view_tabs.user_id)
      )
    )
    OR (
      view_tabs.cohort_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cohort_managers cm
        WHERE cm.cohort_id = view_tabs.cohort_id AND cm.manager_id = auth.uid()
      )
    )
    OR (
      view_tabs.program_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.program_managers pm
        WHERE pm.program_id = view_tabs.program_id AND pm.manager_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      view_tabs.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'manager'
          AND public.is_manager_permissions_target(u.id, view_tabs.user_id)
      )
    )
    OR (
      view_tabs.cohort_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cohort_managers cm
        WHERE cm.cohort_id = view_tabs.cohort_id AND cm.manager_id = auth.uid()
      )
    )
    OR (
      view_tabs.program_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.program_managers pm
        WHERE pm.program_id = view_tabs.program_id AND pm.manager_id = auth.uid()
      )
    )
  );

-- =====================================================
-- Cohorts: managers may create new cohorts and self-assign
-- =====================================================
DROP POLICY IF EXISTS "cohorts_manager_insert" ON public.cohorts;
CREATE POLICY "cohorts_manager_insert" ON public.cohorts
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
  );

DROP POLICY IF EXISTS "cohort_managers_self_insert" ON public.cohort_managers;
CREATE POLICY "cohort_managers_self_insert" ON public.cohort_managers
  FOR INSERT
  WITH CHECK (
    manager_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
  );

DROP POLICY IF EXISTS "cohort_managers_self_delete" ON public.cohort_managers;
CREATE POLICY "cohort_managers_self_delete" ON public.cohort_managers
  FOR DELETE
  USING (
    manager_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Invitations: managers read only rows they own or for their mentors
DROP POLICY IF EXISTS "Managers read team invitations" ON public.invitations;
CREATE POLICY "Managers read team invitations" ON public.invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'manager'
        AND (
          invitations.manager_id = u.id
          OR invitations.mentor_id = u.id
          OR public.is_manager_team_user(u.id, invitations.mentor_id)
          OR public.is_manager_team_user(u.id, invitations.manager_id)
        )
    )
  );

NOTIFY pgrst, 'reload schema';
