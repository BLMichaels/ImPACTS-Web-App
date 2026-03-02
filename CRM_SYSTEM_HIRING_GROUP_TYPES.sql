-- CRM: Add "System" and "Hiring Group" contact types and linked_system_ids for bidirectional links.
-- Run in Supabase SQL Editor.

-- Allow new contact_type values (system, hiring_group)
-- No enum change needed if contact_type is TEXT.

-- Add linked_system_ids for Hiring Group contacts (systems associated with this hiring group)
ALTER TABLE public.crm_organizations
  ADD COLUMN IF NOT EXISTS linked_system_ids UUID[] DEFAULT ARRAY[]::UUID[];

COMMENT ON COLUMN public.crm_organizations.linked_system_ids IS 'For contact_type=hiring_group: CRM contact IDs of System contacts associated with this hiring group.';
