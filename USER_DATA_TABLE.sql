-- Per-user key/value JSON storage so all app data lives in Supabase (no localStorage).
-- Replaces: activities, gapPlans, simulation_*, milestones, readinessScores, mentorActivities,
-- mentorHospitals, mentorContacts, mentorWages, tab_visibility, prsQuestions, prsReadinessScores,
-- pipeline data, CRM prefs, etc.

CREATE TABLE IF NOT EXISTS public.user_data (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  data_key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, data_key)
);

COMMENT ON TABLE public.user_data IS 'Per-user JSON blobs keyed by data_key. Replaces localStorage for activities, gap plans, simulation data, preferences, etc.';

CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON public.user_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_updated_at ON public.user_data(updated_at DESC);

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own rows
DROP POLICY IF EXISTS "user_data_own_all" ON public.user_data;
CREATE POLICY "user_data_own_all" ON public.user_data
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read/write all (for viewing team data, support, etc.)
DROP POLICY IF EXISTS "user_data_admin_all" ON public.user_data;
CREATE POLICY "user_data_admin_all" ON public.user_data
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Managers can read/write tab_visibility for users they manage (team members)
DROP POLICY IF EXISTS "user_data_manager_tab_visibility" ON public.user_data;
CREATE POLICY "user_data_manager_tab_visibility" ON public.user_data
  FOR ALL
  USING (
    public.user_data.data_key = 'tab_visibility'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'manager'
      AND (public.user_data.user_id = u.id OR public.user_data.user_id IN (
        SELECT id FROM public.users WHERE manager_id = auth.uid()
        UNION
        SELECT mentor_id FROM public.users WHERE manager_id = auth.uid() AND mentor_id IS NOT NULL
      ))
    )
  )
  WITH CHECK (
    public.user_data.data_key = 'tab_visibility'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'manager'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;
