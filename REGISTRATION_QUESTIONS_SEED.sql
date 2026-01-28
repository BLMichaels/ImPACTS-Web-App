-- Optional: seed a few default "Additional questions" for the registration page.
-- Run in Supabase SQL Editor *after* REGISTRATION_QUESTIONS_MIGRATION.sql.
-- Only inserts if the table is empty (safe to run again).
-- The register form already has: hospital, name, email, phone, job title, department, NPRQI, additional contact.
-- These appear under "Additional questions" on the form.

INSERT INTO public.registration_questions (label, question_type, required, options, sort_order, is_active)
SELECT * FROM (VALUES
  ('How did you hear about this program?', 'short_answer', false, '[]'::jsonb, 10, true),
  ('Years of experience in pediatric emergency care?', 'number', false, '[]'::jsonb, 20, true),
  ('Any other comments or information you would like to share?', 'paragraph', false, '[]'::jsonb, 30, true)
) AS v(label, question_type, required, options, sort_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.registration_questions LIMIT 1);
