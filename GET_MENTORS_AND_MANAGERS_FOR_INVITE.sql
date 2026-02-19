-- RPC so Send Invitation dialog can reliably load mentor/manager lists (avoids RLS blocking).
-- Callable by admins, managers, or staff with is_admin. Returns app users with role mentor or manager.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.get_mentors_and_managers_for_invite()
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users who can send invitations: admin, manager, or is_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.role::text IN ('admin', 'manager') OR u.is_admin = true)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.first_name, u.last_name, u.email, u.role::text
  FROM public.users u
  WHERE u.role::text IN ('mentor', 'manager')
    AND (u.is_active = true OR u.is_active IS NULL);
END;
$$;

COMMENT ON FUNCTION public.get_mentors_and_managers_for_invite() IS 'Returns mentor and manager users for the Send Invitation dropdown. Callable by admin/manager/is_admin only.';
