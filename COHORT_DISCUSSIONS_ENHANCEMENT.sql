-- Cohort Discussions Enhancement Migration
-- Adds support for rich text, drafts, attachments, and manager deletion
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. Add draft and attachment columns to discussion topics
-- =====================================================
ALTER TABLE public.cohort_discussion_topics 
ADD COLUMN IF NOT EXISTS draft_content TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- =====================================================
-- 2. Add draft and attachment columns to discussion replies
-- =====================================================
ALTER TABLE public.cohort_discussion_replies 
ADD COLUMN IF NOT EXISTS draft_content TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- =====================================================
-- 3. Add indexes for attachments
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_cohort_discussion_topics_attachments ON public.cohort_discussion_topics USING GIN (attachments);
CREATE INDEX IF NOT EXISTS idx_cohort_discussion_replies_attachments ON public.cohort_discussion_replies USING GIN (attachments);

-- =====================================================
-- 4. Update RLS policies to allow managers to delete topics
-- =====================================================
-- Managers can delete topics in cohorts they manage
DROP POLICY IF EXISTS "Managers delete discussion topics" ON public.cohort_discussion_topics;
CREATE POLICY "Managers delete discussion topics" ON public.cohort_discussion_topics
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.cohort_discussion_topics t
      JOIN public.cohort_managers cm ON cm.cohort_id = t.cohort_id
      WHERE t.id = cohort_discussion_topics.id 
      AND cm.manager_id = auth.uid()
    )
  );

-- =====================================================
-- 5. Create storage bucket for discussion attachments (if it doesn't exist)
-- =====================================================
-- Note: This needs to be run in Supabase Dashboard > Storage
-- Create a bucket named 'cohort-discussion-attachments' with public access
-- Or run via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('cohort-discussion-attachments', 'cohort-discussion-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attachments
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
CREATE POLICY "Users can upload attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cohort-discussion-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view attachments" ON storage.objects;
CREATE POLICY "Users can view attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'cohort-discussion-attachments');

DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
CREATE POLICY "Users can delete own attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cohort-discussion-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
