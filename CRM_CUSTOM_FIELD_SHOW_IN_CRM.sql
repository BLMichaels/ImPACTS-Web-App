-- Add show_in_crm to crm_custom_field_definitions so admins can choose where each custom field appears in the CRM.
-- Values: 'both' (quick view and full view), 'quick_view_only', 'full_view_only'. Default 'both'.

ALTER TABLE public.crm_custom_field_definitions
ADD COLUMN IF NOT EXISTS show_in_crm TEXT DEFAULT 'both';

COMMENT ON COLUMN public.crm_custom_field_definitions.show_in_crm IS 'Where to show in CRM: both, quick_view_only, or full_view_only';
