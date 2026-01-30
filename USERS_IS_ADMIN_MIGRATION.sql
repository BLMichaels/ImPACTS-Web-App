-- Allow staff to be granted admin access in addition to their primary role (manager/mentor/pecc).
-- Run in Supabase SQL Editor.

-- Add column: is_admin = true means the user has admin access (in addition to their role).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Backfill: anyone with role 'admin' should have is_admin true
UPDATE public.users SET is_admin = true WHERE role = 'admin';

-- Drop and recreate policies that currently check only role = 'admin' so they also allow is_admin = true.

-- "Admins can manage users" – allow if role = admin OR is_admin
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

-- role_permissions: "Admins manage permissions"
DROP POLICY IF EXISTS "Admins manage permissions" ON public.role_permissions;
CREATE POLICY "Admins manage permissions" ON public.role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

-- "Admins can view all users" – already allows admin or manager; keep as-is for view.
-- "Admins can view all users" stays: role IN ('admin', 'manager'). We could add is_admin for view:
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR u.is_admin = true)
    )
  );
