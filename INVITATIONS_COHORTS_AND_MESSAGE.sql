-- Invitations table: create if missing, then add cohort_ids and custom_message.
-- Run in Supabase SQL Editor.
-- Requires: user_role and invitation_status enums, public.users and public.hospitals tables.

-- 1. Create invitations table if it doesn't exist (full definition including new columns)
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  hospital_id UUID REFERENCES public.hospitals(id),
  mentor_id UUID REFERENCES public.users(id),
  manager_id UUID REFERENCES public.users(id),
  invited_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.users(id),
  cohort_ids UUID[] DEFAULT ARRAY[]::UUID[],
  custom_message TEXT
);

-- 2. Add new columns if table already existed without them
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS cohort_ids UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS custom_message TEXT;

COMMENT ON COLUMN public.invitations.cohort_ids IS 'Cohort IDs to add the PECC to when they accept the invitation.';
COMMENT ON COLUMN public.invitations.custom_message IS 'Optional custom message from the inviter (Mentor/Manager/Admin).';

-- 3. RLS and policies (safe to run if table was just created or already had RLS)
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own invitations" ON public.invitations;
CREATE POLICY "View own invitations" ON public.invitations
  FOR SELECT USING (invited_by = auth.uid());

DROP POLICY IF EXISTS "Admins/Managers view invitations" ON public.invitations;
CREATE POLICY "Admins/Managers view invitations" ON public.invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Create invitations" ON public.invitations;
CREATE POLICY "Create invitations" ON public.invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager', 'mentor')
    )
  );

DROP POLICY IF EXISTS "Public read for acceptance" ON public.invitations;
CREATE POLICY "Public read for acceptance" ON public.invitations
  FOR SELECT USING (status = 'pending');

-- Allow update (e.g. mark accepted)
DROP POLICY IF EXISTS "Update invitations for acceptance" ON public.invitations;
CREATE POLICY "Update invitations for acceptance" ON public.invitations
  FOR UPDATE USING (status = 'pending');

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
