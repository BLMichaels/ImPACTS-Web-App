-- PECC registration: configurable questions + extended user fields.
-- Run in Supabase SQL Editor. Requires public.users and public.hospitals.

-- ============================================
-- REGISTRATION QUESTIONS (admin-managed)
-- ============================================
CREATE TABLE IF NOT EXISTS public.registration_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'short_answer'
    CHECK (question_type IN (
      'short_answer', 'paragraph', 'checkbox', 'radio', 'date',
      'select', 'number', 'email', 'phone'
    )),
  required BOOLEAN NOT NULL DEFAULT false,
  options JSONB DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.registration_questions IS 'Admin-configurable questions shown on PECC registration.';
COMMENT ON COLUMN public.registration_questions.options IS 'For radio/select: ["Option A","Option B"].';

ALTER TABLE public.registration_questions ENABLE ROW LEVEL SECURITY;

-- Public read for active questions (registration form is used before login).
CREATE POLICY "Public read active registration questions"
  ON public.registration_questions FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage registration questions"
  ON public.registration_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ============================================
-- USERS: PECC registration fields
-- ============================================
-- Hospital: from CRM (facility_id) or "Other" (hospital_other text).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hospital_facility_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hospital_other TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nprqi_participant BOOLEAN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS additional_contact_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS additional_contact_email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS additional_contact_job_title TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hospital_system TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS registration_answers JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.registration_answers IS 'Answers to dynamic registration questions: { "question_id": "value" }.'
