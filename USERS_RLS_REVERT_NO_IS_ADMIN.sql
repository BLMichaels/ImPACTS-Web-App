-- Revert users/role_permissions RLS policies to NOT use is_admin (fixes 500 on profile load).
-- Run this in Supabase SQL Editor if profile fetch still returns 500 after adding is_admin.

-- users: Admins can manage all users (role only)
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- users: Admins and managers can view all users (role only)
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager'))
  );

-- role_permissions: Admins manage permissions (role only)
DROP POLICY IF EXISTS "Admins manage permissions" ON public.role_permissions;
CREATE POLICY "Admins manage permissions" ON public.role_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
