-- Link registration questions to CRM/user fields (e.g. First Name, Hospital).
-- Run in Supabase SQL Editor after REGISTRATION_QUESTIONS_MIGRATION.sql.

ALTER TABLE public.registration_questions
  ADD COLUMN IF NOT EXISTS linked_crm_field TEXT;

COMMENT ON COLUMN public.registration_questions.linked_crm_field IS 'If set, answer is stored in users table: first_name, last_name, phone, email, job_title, department, hospital_system, nprqi_participant, additional_contact_name, additional_contact_email, additional_contact_job_title, or hospital (state/city/name picker from CRM).';
