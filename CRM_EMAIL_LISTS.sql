-- Named CRM email lists for Admin (and platform-admin staff).
-- Run in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (u.role::text = 'admin' OR COALESCE(u.is_admin, false))
      FROM public.users u
      WHERE u.id = auth.uid()
      LIMIT 1
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.crm_email_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_email_lists_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_email_lists_name_ci
  ON public.crm_email_lists (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.crm_email_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.crm_email_lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  organization TEXT,
  contact_type TEXT,
  source_kind TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_email_list_members_email_not_blank CHECK (length(btrim(email)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_email_list_members_list_email_ci
  ON public.crm_email_list_members (list_id, lower(btrim(email)));

CREATE INDEX IF NOT EXISTS idx_crm_email_list_members_list_id
  ON public.crm_email_list_members(list_id);

ALTER TABLE public.crm_email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_email_list_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage crm_email_lists" ON public.crm_email_lists;
CREATE POLICY "Admins manage crm_email_lists"
  ON public.crm_email_lists
  FOR ALL
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins manage crm_email_list_members" ON public.crm_email_list_members;
CREATE POLICY "Admins manage crm_email_list_members"
  ON public.crm_email_list_members
  FOR ALL
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_email_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_email_list_members TO authenticated;

COMMENT ON TABLE public.crm_email_lists IS 'Named Admin CRM email lists (ad-hoc audiences, not programs/cohorts).';
COMMENT ON TABLE public.crm_email_list_members IS 'Email addresses on a CRM list; keyed by normalized email per list.';
