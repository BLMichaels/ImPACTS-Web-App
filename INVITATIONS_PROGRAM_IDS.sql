-- Add program_ids to invitations table (optional pre-designate programs for invitee).
-- Run in Supabase SQL Editor.

ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS program_ids UUID[] DEFAULT ARRAY[]::UUID[];
COMMENT ON COLUMN public.invitations.program_ids IS 'Program IDs to associate with the user when they accept the invitation.';
