-- Allow mentors/managers to read PECC full-site sharing approval (not write).
-- Without this, mentors see "Full view target: Unavailable" even when the PECC enabled sharing,
-- because user_data RLS previously only allowed own-row and admin access.

DROP POLICY IF EXISTS "user_data_mentor_manager_pecc_sharing_read" ON public.user_data;
CREATE POLICY "user_data_mentor_manager_pecc_sharing_read" ON public.user_data
  FOR SELECT
  TO authenticated
  USING (
    data_key = 'pecc_allow_manager_mentor_full_view'
    AND (
      EXISTS (
        SELECT 1
        FROM public.users pecc
        WHERE pecc.id = user_data.user_id
          AND pecc.role = 'pecc'
          AND pecc.mentor_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.users pecc
        WHERE pecc.id = user_data.user_id
          AND pecc.role = 'pecc'
          AND pecc.manager_id_for_pecc = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.users pecc
        JOIN public.users mentor ON mentor.id = pecc.mentor_id
        WHERE pecc.id = user_data.user_id
          AND pecc.role = 'pecc'
          AND mentor.manager_id = auth.uid()
      )
    )
  );
