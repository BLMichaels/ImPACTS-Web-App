-- CRM: notes log, activity log, per-user reminders, and hospital system.
-- Run in Supabase SQL Editor after CRM_CUSTOM_FIELDS_MIGRATION.sql.

-- Hospital system (health system / network this hospital is part of).
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS hospital_system TEXT;
COMMENT ON COLUMN public.hospitals.hospital_system IS 'Hospital system or health network (primary field in CRM contact view).';

-- Notes log: array of { date, text } on each contact (hospital or future crm_contacts).
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS notes_log JSONB DEFAULT '[]';
COMMENT ON COLUMN public.hospitals.notes_log IS 'CRM notes log: [{ "date": "YYYY-MM-DD", "text": "..." }]. Newest first in UI.';

-- Activity log: communications, visits, follow-up notes on the contact.
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]';
COMMENT ON COLUMN public.hospitals.activity_log IS 'CRM activity log: [{ "type": "communication"|"visit"|"follow_up", "date": "YYYY-MM-DD", "text": "..." }].';

-- Per-user follow-up reminders (Mentors, Managers, Admins only in app).
-- contact_id is facility_id for hospitals, or any CRM contact id string.
CREATE TABLE IF NOT EXISTS public.crm_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  contact_name TEXT,
  remind_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_reminders_user_id ON public.crm_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_reminders_remind_at ON public.crm_reminders(remind_at);

ALTER TABLE public.crm_reminders ENABLE ROW LEVEL SECURITY;

-- Users see only their own reminders.
CREATE POLICY "Users manage own CRM reminders" ON public.crm_reminders
  FOR ALL USING (auth.uid() = user_id);
