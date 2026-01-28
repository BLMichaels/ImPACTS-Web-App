-- Add logic and role targeting to registration questions.
-- Run in Supabase SQL Editor after REGISTRATION_QUESTIONS_MIGRATION.sql.

-- Who sees this question: PECC, Mentor, and/or Manager. Empty/null = all.
ALTER TABLE public.registration_questions
  ADD COLUMN IF NOT EXISTS target_roles JSONB DEFAULT '["pecc","mentor","manager"]';
COMMENT ON COLUMN public.registration_questions.target_roles IS 'Roles this question applies to: ["pecc","mentor","manager"]. Empty array or null = show for all.';

-- Optional "show only when" logic: show this question only when another answer matches.
-- Format: { "question_id": "uuid", "operator": "equals"|"not_empty"|"in", "value": "..." or ["A","B"] }
ALTER TABLE public.registration_questions
  ADD COLUMN IF NOT EXISTS display_condition JSONB;
COMMENT ON COLUMN public.registration_questions.display_condition IS 'Show only when: {"question_id":"uuid","operator":"equals"|"not_empty"|"in","value":"..."}. For "in", value is ["A","B"]. Omit or null = always show.';
