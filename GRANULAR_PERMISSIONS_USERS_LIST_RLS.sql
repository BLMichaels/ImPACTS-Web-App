-- Granular Permissions: ensure admins see all users (all tiers) in User Permissions tab
-- If the User Permissions dropdown only shows Admins, RLS on public.users may be
-- restricting SELECT. This script:
-- 1. Adds a SECURITY DEFINER function so "can view all users" is checked without RLS recursion.
-- 2. Recreates the "Admins can view all users" policy so admin/manager/is_admin see every user.
-- 3. Adds an RPC the frontend can call to load the full user list (backup if RLS still misbehaves).
-- Run in Supabase SQL Editor.

-- 1. Function: does the current user have permission to view all users? (SECURITY DEFINER = no RLS recursion)
-- Use LOWER(TRIM(role)) so 'Admin', 'admin', 'Manager', etc. all match (DB may store mixed case).
CREATE OR REPLACE FUNCTION public.current_user_can_view_all_users()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND (LOWER(TRIM(COALESCE(role::text, ''))) IN ('admin', 'manager') OR is_admin = true)
  );
$$;

-- 2. Recreate SELECT policy so admin/manager/is_admin see all rows (not just admins)
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (public.current_user_can_view_all_users());

-- 3. RPC for Granular Permissions UI: returns all users when caller is admin/manager/is_admin (SECURITY DEFINER so owner bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_users_for_granular_permissions()
RETURNS SETOF public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.*
  FROM public.users u
  WHERE public.current_user_can_view_all_users();
$$;

COMMENT ON FUNCTION public.get_users_for_granular_permissions() IS
  'Returns all users for Granular Permissions when caller is admin/manager or is_admin.';
