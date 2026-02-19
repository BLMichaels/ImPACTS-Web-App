-- Run this in Supabase SQL Editor before your demo so all tabs persist to Supabase
-- and Snapshot shows Activities, Gap Plans, Milestones, PRS, etc.
-- Safe to run multiple times (idempotent).

-- =====================================================
-- 1. user_data: Activities, Gap Plans, Simulation, Milestones, Snapshot, CRM prefs, etc.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_data (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  data_key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, data_key)
);

CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON public.user_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_updated_at ON public.user_data(updated_at DESC);

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_data_own_all" ON public.user_data;
CREATE POLICY "user_data_own_all" ON public.user_data
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_data_admin_all" ON public.user_data;
CREATE POLICY "user_data_admin_all" ON public.user_data
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)));

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
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'manager')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;
