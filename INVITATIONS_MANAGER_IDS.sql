-- Dual-supervisor support on invitations (run in Supabase SQL Editor).
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS manager_ids UUID[] DEFAULT ARRAY[]::UUID[];
COMMENT ON COLUMN public.invitations.manager_ids IS 'All manager IDs for mentor/PECC invites; manager_id remains the primary supervisor.';
