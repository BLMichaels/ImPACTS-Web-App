-- Fix Function Search Path Security Warnings
-- This addresses Supabase security warnings about mutable search_path
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. Fix update_topic_reply_stats function
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_topic_reply_stats()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cohort_discussion_topics
    SET 
      reply_count = reply_count + 1,
      last_reply_at = NEW.created_at,
      last_reply_by = NEW.created_by,
      updated_at = now()
    WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.cohort_discussion_topics
    SET 
      reply_count = GREATEST(0, reply_count - 1),
      updated_at = now()
    WHERE id = OLD.topic_id;
  END IF;
  RETURN NULL;
END;
$$;

-- =====================================================
-- 2. Fix set_updated_at function
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- 3. Fix update_cohort_updated_at function
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_cohort_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- 4. Fix is_admin_user function
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_user_id 
    AND (role = 'admin' OR is_admin = true)
  );
END;
$$;

-- =====================================================
-- 5. Fix is_cohort_member function
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_cohort_member(p_cohort_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cohort_members
    WHERE cohort_id = p_cohort_id 
    AND user_id = p_user_id
    AND status = 'active'
  );
END;
$$;

-- =====================================================
-- 6. Fix is_cohort_manager function
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_cohort_manager(p_cohort_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cohort_managers
    WHERE cohort_id = p_cohort_id 
    AND manager_id = p_user_id
  );
END;
$$;

-- =====================================================
-- 7. Fix is_program_member function
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_program_member(p_program_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.program_members
    WHERE program_id = p_program_id 
    AND user_id = p_user_id
    AND status = 'active'
  );
END;
$$;

-- =====================================================
-- 8. Fix is_program_manager function
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_program_manager(p_program_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.program_managers
    WHERE program_id = p_program_id 
    AND manager_id = p_user_id
  );
END;
$$;

-- =====================================================
-- 9. Fix update_program_updated_at function
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_program_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- 10. Fix handle_new_user function
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- =====================================================
-- 11. Verify functions have search_path set
-- =====================================================
-- Check that all functions have search_path set
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
  'update_topic_reply_stats',
  'set_updated_at',
  'update_cohort_updated_at',
  'is_admin_user',
  'is_cohort_member',
  'is_cohort_manager',
  'is_program_member',
  'is_program_manager',
  'update_program_updated_at',
  'handle_new_user'
)
ORDER BY p.proname;

-- =====================================================
-- NOTE: Leaked Password Protection
-- =====================================================
-- The "Leaked Password Protection Disabled" warning is a Supabase Auth setting
-- that cannot be fixed via SQL. To enable it:
-- 1. Go to Supabase Dashboard > Authentication > Settings
-- 2. Enable "Leaked Password Protection" 
-- 3. This will check passwords against HaveIBeenPwned.org database
