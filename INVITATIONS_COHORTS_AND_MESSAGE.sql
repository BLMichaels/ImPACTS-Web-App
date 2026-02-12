-- Add pre-designated cohorts and custom message to PECC invitations.
-- Run in Supabase SQL Editor.

-- Pre-designated cohort IDs (PECC will be added to these cohorts on acceptance)
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS cohort_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Optional custom message from inviter (shown on invitation page / email)
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS custom_message TEXT;

COMMENT ON COLUMN public.invitations.cohort_ids IS 'Cohort IDs to add the PECC to when they accept the invitation.';
COMMENT ON COLUMN public.invitations.custom_message IS 'Optional custom message from the inviter (Mentor/Manager/Admin).';
