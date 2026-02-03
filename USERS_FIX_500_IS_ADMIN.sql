-- Fix 500 when loading profile: ensure is_admin exists so RLS policies don't error.
-- Run this in Supabase SQL Editor. If your users table already has is_admin, this is harmless.

-- 1. Add column if it was never added (policies from USERS_IS_ADMIN_MIGRATION reference it)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill so existing admins keep access
UPDATE public.users SET is_admin = true WHERE role = 'admin';

-- If you still get 500 after the above, run the block below to revert policies to not use is_admin:
/*
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager'))
  );

DROP POLICY IF EXISTS "Admins manage permissions" ON public.role_permissions;
CREATE POLICY "Admins manage permissions" ON public.role_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
*/
