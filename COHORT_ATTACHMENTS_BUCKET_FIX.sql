-- Fix missing Storage bucket for cohort discussion/resource file uploads
-- Safe to run multiple times.

-- 1) Create the expected bucket (private; links served via signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cohort-discussion-attachments', 'cohort-discussion-attachments', false)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = false
WHERE id = 'cohort-discussion-attachments';

-- 2) Ensure authenticated users can upload attachments
DROP POLICY IF EXISTS "cohort attachments upload authenticated" ON storage.objects;
CREATE POLICY "cohort attachments upload authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cohort-discussion-attachments'
);

-- 3) Allow authenticated users to read objects so signed URL generation can work
DROP POLICY IF EXISTS "cohort attachments read public" ON storage.objects;
DROP POLICY IF EXISTS "cohort attachments read authenticated" ON storage.objects;
CREATE POLICY "cohort attachments read authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cohort-discussion-attachments'
);

-- 4) Allow owners to delete their own uploaded attachments
DROP POLICY IF EXISTS "cohort attachments delete owner" ON storage.objects;
CREATE POLICY "cohort attachments delete owner"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cohort-discussion-attachments'
  AND owner = auth.uid()
);
