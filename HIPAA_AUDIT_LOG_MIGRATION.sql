-- HIPAA-oriented audit log: record who changed what and when on sensitive tables.
-- Run this in the Supabase SQL Editor if you want database-level audit trails.
-- Retain logs per your policy (e.g., 6 years); consider a retention job later.

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_values JSONB,
  new_values JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON public.audit_log (performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log (adjust if you want managers/auditors too).
-- If your users table has is_admin (from USERS_IS_ADMIN_MIGRATION.sql), you can extend to: u.role = 'admin' OR u.is_admin = true
DROP POLICY IF EXISTS "Admins can read audit_log" ON public.audit_log;
CREATE POLICY "Admins can read audit_log" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

-- No one can insert/update/delete audit_log from the app; only triggers do (run as service role or table owner)
-- So we don't grant INSERT to anon/authenticated; the trigger runs with definer rights.
-- If your triggers run as the table owner, they can INSERT. If you use SECURITY DEFINER on the function, same.
-- We allow the trigger function to insert by not restricting INSERT with RLS for the role that runs migrations.
-- Alternatively: use a trigger that runs with SECURITY DEFINER and inserts into audit_log (bypasses RLS for that insert).
-- Supabase: triggers run in the same transaction as the statement; the "user" is the authenticated user, so RLS applies.
-- So we need to allow INSERT from the same user that performed the action, or use a SECURITY DEFINER function.

-- Allow inserts from the trigger (trigger runs as table owner, so we need a policy that allows insert from service role or use DEFINER)
-- Easiest: allow authenticated users to insert (the trigger runs in their session). That would let any user insert arbitrary rows.
-- Better: use a trigger function with SECURITY DEFINER that inserts into audit_log; then only the function can insert.
-- So: create the function with SECURITY DEFINER and set search_path; then only that function inserts.

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_id_val TEXT;
  old_json JSONB;
  new_json JSONB;
BEGIN
  row_id_val := COALESCE(NEW.id::TEXT, OLD.id::TEXT);
  old_json := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  new_json := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;

  INSERT INTO public.audit_log (table_name, operation, row_id, performed_by, old_values, new_values)
  VALUES (TG_TABLE_NAME, TG_OP, row_id_val, auth.uid(), old_json, new_json);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Attach to sensitive tables (adjust list as needed)
DROP TRIGGER IF EXISTS audit_users ON public.users;
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_hospitals ON public.hospitals;
CREATE TRIGGER audit_hospitals
  AFTER INSERT OR UPDATE OR DELETE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_hospital_contacts ON public.hospital_contacts;
CREATE TRIGGER audit_hospital_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.hospital_contacts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- crm_organizations if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_organizations') THEN
    DROP TRIGGER IF EXISTS audit_crm_organizations ON public.crm_organizations;
    EXECUTE 'CREATE TRIGGER audit_crm_organizations AFTER INSERT OR UPDATE OR DELETE ON public.crm_organizations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()';
  END IF;
END $$;

-- crm_reminders if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_reminders') THEN
    DROP TRIGGER IF EXISTS audit_crm_reminders ON public.crm_reminders;
    EXECUTE 'CREATE TRIGGER audit_crm_reminders AFTER INSERT OR UPDATE OR DELETE ON public.crm_reminders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()';
  END IF;
END $$;

COMMENT ON TABLE public.audit_log IS 'HIPAA-oriented audit trail: who changed what and when on sensitive tables. Retain per policy (e.g., 6 years).';
