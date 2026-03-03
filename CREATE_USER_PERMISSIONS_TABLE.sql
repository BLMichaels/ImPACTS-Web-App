-- Create user_permissions table if missing (fixes 404 on Granular Permissions toggles)
-- Run this in Supabase SQL Editor if you get: user_permissions 404 (Not Found)

-- Table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES public.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_key ON public.user_permissions(permission_key);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent: drop then create)
DROP POLICY IF EXISTS "Users view own permissions" ON public.user_permissions;
CREATE POLICY "Users view own permissions" ON public.user_permissions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage user permissions" ON public.user_permissions;
CREATE POLICY "Admins manage user permissions" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (LOWER(TRIM(COALESCE(u.role::text, ''))) = 'admin' OR u.is_admin = true)
    )
  );

DROP POLICY IF EXISTS "Managers manage team permissions" ON public.user_permissions;
CREATE POLICY "Managers manage team permissions" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND LOWER(TRIM(COALESCE(u.role::text, ''))) = 'manager'
      AND (
        EXISTS (SELECT 1 FROM public.users target WHERE target.id = user_permissions.user_id AND target.role = 'mentor' AND target.manager_id = u.id)
        OR
        EXISTS (SELECT 1 FROM public.users target WHERE target.id = user_permissions.user_id AND target.role = 'pecc' AND target.manager_id_for_pecc = u.id)
        OR
        EXISTS (
          SELECT 1 FROM public.users target
          JOIN public.users mentor ON mentor.id = target.mentor_id
          WHERE target.id = user_permissions.user_id AND target.role = 'pecc' AND mentor.manager_id = u.id
        )
      )
    )
  );
