-- Pending User Permissions: allow setting permissions for CRM contacts before they have accounts
-- When they create an account, these permissions are automatically applied.
-- Run this in Supabase SQL Editor.

-- =====================================================
-- 1. Create pending_user_permissions table (by email)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pending_user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES public.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_pending_user_permissions_email ON public.pending_user_permissions(LOWER(TRIM(email)));
CREATE INDEX IF NOT EXISTS idx_pending_user_permissions_permission_key ON public.pending_user_permissions(permission_key);

ALTER TABLE public.pending_user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pending user permissions" ON public.pending_user_permissions;
CREATE POLICY "Admins manage pending user permissions" ON public.pending_user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (LOWER(TRIM(COALESCE(u.role::text, ''))) = 'admin' OR u.is_admin = true)
    )
  );

-- =====================================================
-- 2. Create pending_view_tabs table (by email)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pending_view_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  tab_key TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES public.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, tab_key)
);

CREATE INDEX IF NOT EXISTS idx_pending_view_tabs_email ON public.pending_view_tabs(LOWER(TRIM(email)));

ALTER TABLE public.pending_view_tabs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pending view tabs" ON public.pending_view_tabs;
CREATE POLICY "Admins manage pending view tabs" ON public.pending_view_tabs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (LOWER(TRIM(COALESCE(u.role::text, ''))) = 'admin' OR u.is_admin = true)
    )
  );

-- =====================================================
-- 3. Migrate pending permissions to user_permissions on signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.migrate_pending_permissions_on_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_perm RECORD;
  v_tab RECORD;
BEGIN
  v_email := LOWER(TRIM(COALESCE(NEW.email, '')));
  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  -- Copy pending_user_permissions to user_permissions
  FOR v_perm IN
    SELECT permission_key, is_enabled, granted_by
    FROM public.pending_user_permissions
    WHERE LOWER(TRIM(email)) = v_email
  LOOP
    INSERT INTO public.user_permissions (user_id, permission_key, is_enabled, granted_by, granted_at, updated_at)
    VALUES (NEW.id, v_perm.permission_key, v_perm.is_enabled, v_perm.granted_by, now(), now())
    ON CONFLICT (user_id, permission_key) DO UPDATE SET
      is_enabled = EXCLUDED.is_enabled,
      granted_by = EXCLUDED.granted_by,
      updated_at = now();
  END LOOP;

  -- Copy pending_view_tabs to view_tabs
  FOR v_tab IN
    SELECT tab_key, is_visible, granted_by
    FROM public.pending_view_tabs
    WHERE LOWER(TRIM(email)) = v_email
  LOOP
    INSERT INTO public.view_tabs (user_id, cohort_id, program_id, tab_key, is_visible, granted_by, granted_at, updated_at)
    VALUES (NEW.id, NULL, NULL, v_tab.tab_key, v_tab.is_visible, v_tab.granted_by, now(), now())
    ON CONFLICT (user_id, tab_key) WHERE user_id IS NOT NULL DO UPDATE SET
      is_visible = EXCLUDED.is_visible,
      granted_by = EXCLUDED.granted_by,
      updated_at = now();
  END LOOP;

  -- Remove migrated rows from pending tables
  DELETE FROM public.pending_user_permissions WHERE LOWER(TRIM(email)) = v_email;
  DELETE FROM public.pending_view_tabs WHERE LOWER(TRIM(email)) = v_email;

  RETURN NEW;
END;
$$;

-- Trigger: run after users row is created (handle_new_user creates it from auth.users)
DROP TRIGGER IF EXISTS migrate_pending_permissions_on_user_created ON public.users;
CREATE TRIGGER migrate_pending_permissions_on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.migrate_pending_permissions_on_user_created();

COMMENT ON TABLE public.pending_user_permissions IS 'Permissions for CRM contacts who have not yet created accounts. Migrated to user_permissions on signup.';
COMMENT ON TABLE public.pending_view_tabs IS 'Tab visibility for CRM contacts who have not yet created accounts. Migrated to view_tabs on signup.';
