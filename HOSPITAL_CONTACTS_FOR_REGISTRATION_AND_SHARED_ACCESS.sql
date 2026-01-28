-- Ensure each person is added to the CRM (hospital_contacts) when they register or get shared access.
-- Run in Supabase SQL Editor. Requires public.hospital_contacts and public.hospitals.

-- Allow upsert by (hospital_id, user_id): one contact row per user per hospital
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.hospital_contacts'::regclass AND conname = 'hospital_contacts_hospital_id_user_id_key'
  ) THEN
    ALTER TABLE public.hospital_contacts
      ADD CONSTRAINT hospital_contacts_hospital_id_user_id_key UNIQUE (hospital_id, user_id);
  END IF;
END $$;

-- Let new users insert their own contact when registering (user_id = auth.uid())
DROP POLICY IF EXISTS "Users can insert own hospital_contact" ON public.hospital_contacts;
CREATE POLICY "Users can insert own hospital_contact"
  ON public.hospital_contacts FOR INSERT
  WITH CHECK (user_id = auth.uid());
