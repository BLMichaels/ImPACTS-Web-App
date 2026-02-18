-- Registration questions: target by program/cohort (e.g. LA Peds Ready only), and optional "show in CRM" for custom answers.
-- Run after REGISTRATION_QUESTIONS_MIGRATION.sql and REGISTRATION_QUESTIONS_LOGIC_AND_ROLES_MIGRATION.sql.

-- Show question only for invites/users in these programs (null/empty = show for all)
ALTER TABLE public.registration_questions
  ADD COLUMN IF NOT EXISTS target_program_ids UUID[] DEFAULT NULL;
COMMENT ON COLUMN public.registration_questions.target_program_ids IS 'Show this question only when invite/context includes one of these program IDs. NULL or empty = show for all.';

-- Show question only for invites/users in these cohorts (null/empty = show for all)
ALTER TABLE public.registration_questions
  ADD COLUMN IF NOT EXISTS target_cohort_ids UUID[] DEFAULT NULL;
COMMENT ON COLUMN public.registration_questions.target_cohort_ids IS 'Show this question only when invite/context includes one of these cohort IDs. NULL or empty = show for all.';

-- When true, this question’s answer is shown in CRM contact view (from users.registration_answers). Use when not linked to an existing user/CRM column.
ALTER TABLE public.registration_questions
  ADD COLUMN IF NOT EXISTS display_in_crm BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.registration_questions.display_in_crm IS 'If true, show this question’s answer in CRM contact view (from registration_answers). Use for “Create new CRM field” when no existing column is linked.';
