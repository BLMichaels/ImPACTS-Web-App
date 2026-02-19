-- RPC so Send Account Invitation dialog reliably shows Mentor and Manager dropdowns.
-- Returns: (1) App users with role mentor/manager, and (2) Any app user whose email
-- appears as a Manager or Mentor contact in the CRM (so CRM-added managers show up).
-- Run in Supabase SQL Editor. Re-run after changes.

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
      AND (u.role::text IN ('admin', 'manager') OR COALESCE(u.is_admin, false) = true)
  ) THEN
    RETURN;
  END IF;

  -- (1) Users who already have role mentor or manager (include all, do not filter by is_active so new accounts show)
  RETURN QUERY
  SELECT u.id, u.first_name, u.last_name, u.email, u.role::text
  FROM public.users u
  WHERE u.role::text IN ('mentor', 'manager')

  UNION

  -- (2) Users whose email appears in CRM as a Manager or Mentor contact (so CRM-added managers/mentors show in dropdown)
  SELECT u.id, u.first_name, u.last_name, u.email, LOWER(TRIM(c.contact_type))::text AS role
  FROM public.users u
  INNER JOIN public.crm_organizations c
    ON c.contact_type IN ('manager', 'mentor')
   AND TRIM(LOWER(COALESCE(c.email, ''))) = TRIM(LOWER(COALESCE(u.email, '')))
   AND TRIM(LOWER(COALESCE(c.email, ''))) != ''
  WHERE u.role::text NOT IN ('mentor', 'manager');
END;
$$;

COMMENT ON FUNCTION public.get_mentors_and_managers_for_invite() IS 'Returns mentor and manager users for Send Invitation: users with that role plus users matched by email from CRM Manager/Mentor contacts.';
