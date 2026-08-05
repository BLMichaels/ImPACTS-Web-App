-- Allow managers to SELECT team-scoped user_data keys needed for Snapshot/Reports.
-- Without this, batchGetUserDataForKey('mentorActivities' | 'mentor_manager_ids' | ...)
-- silently returns empty under RLS, so Mentor hours and secondary-supervisor scope fail.
--
-- SELECT only. Managers still cannot write other users' activity blobs.
-- Gated by public.is_manager_team_user (SECURITY DEFINER) from MANAGER_TIER_HARDENING.sql.

DROP POLICY IF EXISTS "user_data_manager_team_report_read" ON public.user_data;
CREATE POLICY "user_data_manager_team_report_read" ON public.user_data
  FOR SELECT
  TO authenticated
  USING (
    public.user_data.data_key = ANY (
      ARRAY[
        'mentorActivities',
        'activities',
        'gapPlans',
        'mentor_manager_ids',
        'pecc_direct_manager_ids',
        'pecc_mentor_ids',
        'mentorHospitals'
      ]
    )
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'manager'
        AND public.is_manager_team_user(u.id, public.user_data.user_id)
    )
  );

COMMENT ON POLICY "user_data_manager_team_report_read" ON public.user_data IS
  'Managers may read activity/hierarchy blobs for users in their team hierarchy (reports + snapshot).';
