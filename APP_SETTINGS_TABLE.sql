-- Admin Settings stored in Supabase so they sync across all devices (no localStorage).
-- Keys: email_confirmation_message, pecc_activity_categories, mentor_activity_categories, education_questions

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS 'Admin-configured app-wide settings (email message, activity categories, education content). Replaces localStorage so settings sync across devices.';

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can insert/update/delete
DROP POLICY IF EXISTS "app_settings_admin_all" ON public.app_settings;
CREATE POLICY "app_settings_admin_all" ON public.app_settings
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- All authenticated users can read (so PECC/Mentor/Manager pages can show categories and education content)
DROP POLICY IF EXISTS "app_settings_authenticated_read" ON public.app_settings;
CREATE POLICY "app_settings_authenticated_read" ON public.app_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Public read for keys needed before login (e.g. registration flow may need email message text)
DROP POLICY IF EXISTS "app_settings_public_read" ON public.app_settings;
CREATE POLICY "app_settings_public_read" ON public.app_settings
  FOR SELECT
  USING (true);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
