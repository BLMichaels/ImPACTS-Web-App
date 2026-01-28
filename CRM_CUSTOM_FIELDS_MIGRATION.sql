-- Custom fields for CRM (Admins). Run in Supabase SQL Editor.
-- After this, use "Manage custom fields" in the Admin CRM to add field definitions.

-- Add custom_fields JSONB to hospitals for storing per-contact custom values
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Optional: add a comment so the column purpose is clear
COMMENT ON COLUMN public.hospitals.custom_fields IS 'CRM custom field values (key -> string). Definitions are stored in the app (Admin CRM).';
