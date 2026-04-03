-- Critical RLS alignment: use SECURITY DEFINER helpers (same pattern as USERS_RLS_FIX_500_SECURITY_DEFINER.sql)
-- so invitation and related policies do not recurse through public.users inside policy bodies.
-- Run in Supabase SQL Editor after USERS_RLS_FIX_500_SECURITY_DEFINER.sql (or merge with that script).

-- 1. Role + admin flag for policy checks (single indexed read, no RLS recursion on users)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- True when the signed-in user is admin, manager, or platform admin (is_admin).
CREATE OR REPLACE FUNCTION public.current_user_is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (u.role::text IN ('admin', 'manager') OR COALESCE(u.is_admin, false))
      FROM public.users u
      WHERE u.id = auth.uid()
      LIMIT 1
    ),
    false
  );
$$;

-- Invitations: who may create (mentor/admin/manager or platform admin)
CREATE OR REPLACE FUNCTION public.current_user_can_create_invitation()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (u.role::text IN ('admin', 'manager', 'mentor') OR COALESCE(u.is_admin, false))
      FROM public.users u
      WHERE u.id = auth.uid()
      LIMIT 1
    ),
    false
  );
$$;

-- 2. Invitations: replace subquery-on-users policies with helpers
DROP POLICY IF EXISTS "Admins/Managers view invitations" ON public.invitations;
CREATE POLICY "Admins/Managers view invitations" ON public.invitations
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin_or_manager());

DROP POLICY IF EXISTS "Create invitations" ON public.invitations;
CREATE POLICY "Create invitations" ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_create_invitation());

DROP POLICY IF EXISTS "Privileged update invitations" ON public.invitations;
CREATE POLICY "Privileged update invitations" ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin_or_manager())
  WITH CHECK (public.current_user_is_admin_or_manager());

-- 3. mentor_hospital_assignments: avoid users subquery in policy (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mentor_hospital_assignments'
  ) THEN
    DROP POLICY IF EXISTS "Admins/Managers manage assignments" ON public.mentor_hospital_assignments;
    CREATE POLICY "Admins/Managers manage assignments" ON public.mentor_hospital_assignments
      FOR ALL
      TO authenticated
      USING (public.current_user_is_admin_or_manager())
      WITH CHECK (public.current_user_is_admin_or_manager());
  END IF;
END $$;
