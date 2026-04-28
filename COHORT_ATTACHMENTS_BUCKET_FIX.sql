-- Fix missing Storage bucket for cohort discussion/resource file uploads
-- Safe to run multiple times.

-- 1) Create the expected bucket (public so links open/download directly)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cohort-discussion-attachments', 'cohort-discussion-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2) Ensure authenticated users can upload attachments
DROP POLICY IF EXISTS "cohort attachments upload authenticated" ON storage.objects;
CREATE POLICY "cohort attachments upload authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cohort-discussion-attachments'
);

-- 3) Ensure anyone can read attachments (bucket is public; policy keeps access explicit)
DROP POLICY IF EXISTS "cohort attachments read public" ON storage.objects;
CREATE POLICY "cohort attachments read public"
ON storage.objects
FOR SELECT
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
