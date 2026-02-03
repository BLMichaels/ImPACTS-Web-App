-- Fix 500 on profile load: avoid RLS recursion by using a SECURITY DEFINER function
-- to read the current user's role instead of a subquery on users inside the policy.
-- Run this entire script in Supabase SQL Editor.

-- 1. Function that returns current user's role (bypasses RLS, so no recursion)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. users: Admins can manage all users (uses function, no subquery on users)
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL USING (public.current_user_role() = 'admin');

-- 3. users: Admins and managers can view all users (uses function)
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (public.current_user_role() IN ('admin', 'manager'));

-- 4. role_permissions: Admins manage permissions (uses function)
DROP POLICY IF EXISTS "Admins manage permissions" ON public.role_permissions;
CREATE POLICY "Admins manage permissions" ON public.role_permissions
  FOR ALL USING (public.current_user_role() = 'admin');
