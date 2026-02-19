-- Create public.invitations table if it does not exist (fixes "table not in schema cache").
-- Run once in Supabase SQL Editor. Safe to re-run (idempotent).
-- Requires: public.users and public.hospitals tables.

-- Ensure enums exist (Supabase often has these from users table)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
    CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'mentor', 'pecc');
  END IF;
END$$;

-- Create invitations table with all columns the app expects
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role public.user_role NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  hospital_id UUID REFERENCES public.hospitals(id),
  mentor_id UUID REFERENCES public.users(id),
  manager_id UUID REFERENCES public.users(id),
  invited_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.users(id),
  cohort_ids UUID[] DEFAULT ARRAY[]::UUID[],
  custom_message TEXT,
  program_ids UUID[] DEFAULT ARRAY[]::UUID[]
);

ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS cohort_ids UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS custom_message TEXT;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS program_ids UUID[] DEFAULT ARRAY[]::UUID[];

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "View own invitations" ON public.invitations;
CREATE POLICY "View own invitations" ON public.invitations
  FOR SELECT USING (invited_by = auth.uid());

DROP POLICY IF EXISTS "Admins/Managers view invitations" ON public.invitations;
CREATE POLICY "Admins/Managers view invitations" ON public.invitations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR u.is_admin = true))
  );

DROP POLICY IF EXISTS "Create invitations" ON public.invitations;
CREATE POLICY "Create invitations" ON public.invitations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager', 'mentor') OR u.is_admin = true))
  );

DROP POLICY IF EXISTS "Public read for acceptance" ON public.invitations;
CREATE POLICY "Public read for acceptance" ON public.invitations
  FOR SELECT USING (status = 'pending');

DROP POLICY IF EXISTS "Update invitations for acceptance" ON public.invitations;
CREATE POLICY "Update invitations for acceptance" ON public.invitations
  FOR UPDATE USING (status = 'pending');

CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

GRANT SELECT, INSERT, UPDATE ON public.invitations TO authenticated;
GRANT SELECT ON public.invitations TO anon;
