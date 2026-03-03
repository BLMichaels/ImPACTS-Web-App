-- Granular Permissions: ensure admins see all users (all tiers) in User Permissions tab
-- RUN THIS IN SUPABASE SQL EDITOR if the User Permissions dropdown only shows Admins.
--
-- This script:
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

-- 4. RPC to fetch a single user by ID (for when GPM is opened with userId from CRM but user not in list)
CREATE OR REPLACE FUNCTION public.get_user_by_id_for_admin(p_user_id UUID)
RETURNS SETOF public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.* FROM public.users u
  WHERE u.id = p_user_id
  AND public.current_user_can_view_all_users();
$$;

COMMENT ON FUNCTION public.get_user_by_id_for_admin(UUID) IS
  'Returns a single user by ID when caller is admin/manager or is_admin. Used when opening GPM from CRM with a specific user.';

-- 5. RPC to fetch users by emails (fallback when main RPC fails - e.g. load from CRM contacts)
CREATE OR REPLACE FUNCTION public.get_users_by_emails_for_admin(p_emails TEXT[])
RETURNS SETOF public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.* FROM public.users u
  WHERE public.current_user_can_view_all_users()
  AND LOWER(TRIM(COALESCE(u.email, ''))) IN (
    SELECT LOWER(TRIM(COALESCE(e, ''))) FROM unnest(p_emails) AS e WHERE e IS NOT NULL AND TRIM(COALESCE(e, '')) != ''
  );
$$;

COMMENT ON FUNCTION public.get_users_by_emails_for_admin(TEXT[]) IS
  'Returns users matching the given emails when caller is admin/manager or is_admin. Fallback for GPM user list.';
