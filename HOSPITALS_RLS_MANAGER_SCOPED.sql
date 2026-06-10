-- Optional: scope manager hospital access to team assignments (replaces global hospitals_manager_all).
-- Run in Supabase SQL Editor after review. Keeps admin full access via hospitals_admin_all.

DROP POLICY IF EXISTS "hospitals_manager_all" ON public.hospitals;

CREATE OR REPLACE FUNCTION public.manager_team_hospital_ids(p_manager_id UUID)
RETURNS SETOF UUID AS $$
  SELECT DISTINCT mha.hospital_id
  FROM public.mentor_hospital_assignments mha
  WHERE mha.is_active = true
    AND (
      mha.mentor_id = p_manager_id
      OR mha.mentor_id IN (
        SELECT u.id FROM public.users u
        WHERE u.role = 'mentor' AND u.manager_id = p_manager_id
      )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "hospitals_manager_team_scoped" ON public.hospitals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND id IN (SELECT public.manager_team_hospital_ids(auth.uid()))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND id IN (SELECT public.manager_team_hospital_ids(auth.uid()))
  );

NOTIFY pgrst, 'reload schema';
