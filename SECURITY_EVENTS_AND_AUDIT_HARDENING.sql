-- Security events + audit log hardening (run in Supabase SQL Editor).
-- Companion to HIPAA_AUDIT_LOG_MIGRATION.sql (run that first if not applied).

-- 1. security_events: auth-related events (failed logins, password changes, idle timeouts).
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_failed',
    'password_updated',
    'password_update_required',
    'idle_timeout_logout',
    'password_reset_requested',
    'mfa_enrolled',
    'mfa_challenge_failed'
  )),
  email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_email ON public.security_events(email);

COMMENT ON TABLE public.security_events IS 'Auth/security events: failed logins, password changes, idle-timeout logouts. Append-only; admin read only.';

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Failed logins happen before authentication, so anon inserts must be allowed.
-- The CHECK constraint limits event types; reads are admin-only.
DROP POLICY IF EXISTS "security_events_insert" ON public.security_events;
CREATE POLICY "security_events_insert" ON public.security_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "security_events_admin_read" ON public.security_events;
CREATE POLICY "security_events_admin_read" ON public.security_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

-- Append-only: no UPDATE/DELETE policies and no grants for them.
GRANT INSERT ON public.security_events TO anon, authenticated;
GRANT SELECT ON public.security_events TO authenticated;
REVOKE UPDATE, DELETE ON public.security_events FROM anon, authenticated;

-- 2. Harden audit_log (from HIPAA_AUDIT_LOG_MIGRATION.sql): make it immutable from clients.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log') THEN
    REVOKE UPDATE, DELETE ON public.audit_log FROM anon, authenticated;
  END IF;
END $$;
