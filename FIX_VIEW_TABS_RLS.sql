-- Fix RLS for view_tabs table
-- This addresses the Supabase security vulnerability: RLS Disabled in Public
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. Ensure RLS is enabled
-- =====================================================
ALTER TABLE public.view_tabs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. Drop existing policies (if they exist) to recreate them cleanly
-- =====================================================
DROP POLICY IF EXISTS "Users view own tabs" ON public.view_tabs;
DROP POLICY IF EXISTS "Users view cohort program tabs" ON public.view_tabs;
DROP POLICY IF EXISTS "Admins manage tabs" ON public.view_tabs;
DROP POLICY IF EXISTS "Managers manage team tabs" ON public.view_tabs;
DROP POLICY IF EXISTS "Mentors manage mentee tabs" ON public.view_tabs;

-- =====================================================
-- 3. Create comprehensive RLS policies
-- =====================================================

-- Policy 1: Users can view their own tab settings
CREATE POLICY "Users view own tabs" ON public.view_tabs
  FOR SELECT 
  USING (user_id = auth.uid());

-- Policy 2: Users can view tab settings for cohorts/programs they're members of
CREATE POLICY "Users view cohort program tabs" ON public.view_tabs
  FOR SELECT 
  USING (
    (cohort_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cohort_members cm 
      WHERE cm.cohort_id = view_tabs.cohort_id 
      AND cm.user_id = auth.uid() 
      AND cm.status = 'active'
    ))
    OR
    (program_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.program_members pm 
      WHERE pm.program_id = view_tabs.program_id 
      AND pm.user_id = auth.uid() 
      AND pm.status = 'active'
    ))
  );

-- Policy 3: Admins can do everything (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins manage tabs" ON public.view_tabs
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

-- Policy 4: Managers can manage tabs for their team members, cohorts, and programs
CREATE POLICY "Managers manage team tabs" ON public.view_tabs
  FOR ALL 
  USING (
    (user_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'manager'
      AND (
        EXISTS (SELECT 1 FROM public.users target WHERE target.id = view_tabs.user_id AND target.role = 'mentor' AND target.manager_id = u.id)
        OR
        EXISTS (SELECT 1 FROM public.users target WHERE target.id = view_tabs.user_id AND target.role = 'pecc' AND target.manager_id_for_pecc = u.id)
        OR
        EXISTS (
          SELECT 1 FROM public.users target 
          JOIN public.users mentor ON mentor.id = target.mentor_id
          WHERE target.id = view_tabs.user_id 
          AND target.role = 'pecc' 
          AND mentor.manager_id = u.id
        )
      )
    ))
    OR
    (cohort_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cohort_managers cm 
      WHERE cm.cohort_id = view_tabs.cohort_id 
      AND cm.manager_id = auth.uid()
    ))
    OR
    (program_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.program_managers pm 
      WHERE pm.program_id = view_tabs.program_id 
      AND pm.manager_id = auth.uid()
    ))
  )
  WITH CHECK (
    (user_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'manager'
      AND (
        EXISTS (SELECT 1 FROM public.users target WHERE target.id = view_tabs.user_id AND target.role = 'mentor' AND target.manager_id = u.id)
        OR
        EXISTS (SELECT 1 FROM public.users target WHERE target.id = view_tabs.user_id AND target.role = 'pecc' AND target.manager_id_for_pecc = u.id)
        OR
        EXISTS (
          SELECT 1 FROM public.users target 
          JOIN public.users mentor ON mentor.id = target.mentor_id
          WHERE target.id = view_tabs.user_id 
          AND target.role = 'pecc' 
          AND mentor.manager_id = u.id
        )
      )
    ))
    OR
    (cohort_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cohort_managers cm 
      WHERE cm.cohort_id = view_tabs.cohort_id 
      AND cm.manager_id = auth.uid()
    ))
    OR
    (program_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.program_managers pm 
      WHERE pm.program_id = view_tabs.program_id 
      AND pm.manager_id = auth.uid()
    ))
  );

-- Policy 5: Mentors can manage tabs for their mentees
CREATE POLICY "Mentors manage mentee tabs" ON public.view_tabs
  FOR ALL 
  USING (
    user_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'mentor'
      AND EXISTS (
        SELECT 1 FROM public.users mentee 
        WHERE mentee.id = view_tabs.user_id 
        AND mentee.role = 'pecc' 
        AND mentee.mentor_id = u.id
      )
    )
  )
  WITH CHECK (
    user_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'mentor'
      AND EXISTS (
        SELECT 1 FROM public.users mentee 
        WHERE mentee.id = view_tabs.user_id 
        AND mentee.role = 'pecc' 
        AND mentee.mentor_id = u.id
      )
    )
  );

-- =====================================================
-- 4. Verify RLS is enabled
-- =====================================================
-- Check if RLS is enabled (should return 't' for true)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'view_tabs';

-- List all policies on view_tabs
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'view_tabs';
