-- Fix infinite recursion in cohorts RLS policies
-- Run this in Supabase SQL Editor after the main migration

-- =====================================================
-- Helper function to check cohort membership (avoids recursion)
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_cohort_member(p_cohort_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cohort_members
    WHERE cohort_id = p_cohort_id 
    AND user_id = p_user_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_cohort_manager(p_cohort_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cohort_managers
    WHERE cohort_id = p_cohort_id 
    AND manager_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_user_id 
    AND (role = 'admin' OR is_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- Drop existing problematic policies
-- =====================================================

-- cohorts
DROP POLICY IF EXISTS "Admins full access to cohorts" ON public.cohorts;
DROP POLICY IF EXISTS "Managers manage assigned cohorts" ON public.cohorts;
DROP POLICY IF EXISTS "Members view their cohorts" ON public.cohorts;

-- cohort_members
DROP POLICY IF EXISTS "Admins full access to cohort_members" ON public.cohort_members;
DROP POLICY IF EXISTS "Managers manage cohort members" ON public.cohort_members;
DROP POLICY IF EXISTS "Members view cohort members" ON public.cohort_members;

-- cohort_managers
DROP POLICY IF EXISTS "Admins full access to cohort_managers" ON public.cohort_managers;
DROP POLICY IF EXISTS "Managers view own assignments" ON public.cohort_managers;

-- cohort_announcements
DROP POLICY IF EXISTS "Admins full access to cohort_announcements" ON public.cohort_announcements;
DROP POLICY IF EXISTS "Managers manage cohort announcements" ON public.cohort_announcements;
DROP POLICY IF EXISTS "Members view cohort announcements" ON public.cohort_announcements;

-- cohort_discussion_topics
DROP POLICY IF EXISTS "Admins full access to discussion_topics" ON public.cohort_discussion_topics;
DROP POLICY IF EXISTS "Managers manage discussion topics" ON public.cohort_discussion_topics;
DROP POLICY IF EXISTS "Members view discussion topics" ON public.cohort_discussion_topics;
DROP POLICY IF EXISTS "Members create discussion topics" ON public.cohort_discussion_topics;
DROP POLICY IF EXISTS "Members update own topics" ON public.cohort_discussion_topics;

-- cohort_discussion_replies
DROP POLICY IF EXISTS "Admins full access to discussion_replies" ON public.cohort_discussion_replies;
DROP POLICY IF EXISTS "Managers manage discussion replies" ON public.cohort_discussion_replies;
DROP POLICY IF EXISTS "Members view discussion replies" ON public.cohort_discussion_replies;
DROP POLICY IF EXISTS "Members create discussion replies" ON public.cohort_discussion_replies;
DROP POLICY IF EXISTS "Members update own replies" ON public.cohort_discussion_replies;

-- cohort_invitations
DROP POLICY IF EXISTS "Admins full access to cohort_invitations" ON public.cohort_invitations;
DROP POLICY IF EXISTS "Managers manage cohort invitations" ON public.cohort_invitations;
DROP POLICY IF EXISTS "Mentors create invitations" ON public.cohort_invitations;
DROP POLICY IF EXISTS "Users view own invitations" ON public.cohort_invitations;

-- cohort_read_status
DROP POLICY IF EXISTS "Users manage own read status" ON public.cohort_read_status;


-- =====================================================
-- Recreate policies using helper functions
-- =====================================================

-- COHORTS TABLE
CREATE POLICY "cohorts_admin_all" ON public.cohorts
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "cohorts_manager_all" ON public.cohorts
  FOR ALL USING (public.is_cohort_manager(id, auth.uid()));

CREATE POLICY "cohorts_member_select" ON public.cohorts
  FOR SELECT USING (public.is_cohort_member(id, auth.uid()));


-- COHORT_MEMBERS TABLE
CREATE POLICY "cohort_members_admin_all" ON public.cohort_members
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "cohort_members_manager_all" ON public.cohort_members
  FOR ALL USING (public.is_cohort_manager(cohort_id, auth.uid()));

CREATE POLICY "cohort_members_member_select" ON public.cohort_members
  FOR SELECT USING (public.is_cohort_member(cohort_id, auth.uid()));


-- COHORT_MANAGERS TABLE
CREATE POLICY "cohort_managers_admin_all" ON public.cohort_managers
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "cohort_managers_self_select" ON public.cohort_managers
  FOR SELECT USING (manager_id = auth.uid());


-- COHORT_ANNOUNCEMENTS TABLE
CREATE POLICY "cohort_announcements_admin_all" ON public.cohort_announcements
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "cohort_announcements_manager_all" ON public.cohort_announcements
  FOR ALL USING (public.is_cohort_manager(cohort_id, auth.uid()));

CREATE POLICY "cohort_announcements_member_select" ON public.cohort_announcements
  FOR SELECT USING (public.is_cohort_member(cohort_id, auth.uid()));


-- COHORT_DISCUSSION_TOPICS TABLE
CREATE POLICY "cohort_discussion_topics_admin_all" ON public.cohort_discussion_topics
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "cohort_discussion_topics_manager_all" ON public.cohort_discussion_topics
  FOR ALL USING (public.is_cohort_manager(cohort_id, auth.uid()));

CREATE POLICY "cohort_discussion_topics_member_select" ON public.cohort_discussion_topics
  FOR SELECT USING (public.is_cohort_member(cohort_id, auth.uid()));

CREATE POLICY "cohort_discussion_topics_member_insert" ON public.cohort_discussion_topics
  FOR INSERT WITH CHECK (public.is_cohort_member(cohort_id, auth.uid()));

CREATE POLICY "cohort_discussion_topics_owner_update" ON public.cohort_discussion_topics
  FOR UPDATE USING (created_by = auth.uid());


-- COHORT_DISCUSSION_REPLIES TABLE
CREATE POLICY "cohort_discussion_replies_admin_all" ON public.cohort_discussion_replies
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "cohort_discussion_replies_manager_all" ON public.cohort_discussion_replies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cohort_discussion_topics t
      WHERE t.id = cohort_discussion_replies.topic_id 
      AND public.is_cohort_manager(t.cohort_id, auth.uid())
    )
  );

CREATE POLICY "cohort_discussion_replies_member_select" ON public.cohort_discussion_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cohort_discussion_topics t
      WHERE t.id = cohort_discussion_replies.topic_id 
      AND public.is_cohort_member(t.cohort_id, auth.uid())
    )
  );

CREATE POLICY "cohort_discussion_replies_member_insert" ON public.cohort_discussion_replies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cohort_discussion_topics t
      WHERE t.id = cohort_discussion_replies.topic_id 
      AND public.is_cohort_member(t.cohort_id, auth.uid())
      AND t.is_locked = false
    )
  );

CREATE POLICY "cohort_discussion_replies_owner_update" ON public.cohort_discussion_replies
  FOR UPDATE USING (created_by = auth.uid());


-- COHORT_INVITATIONS TABLE
CREATE POLICY "cohort_invitations_admin_all" ON public.cohort_invitations
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "cohort_invitations_manager_all" ON public.cohort_invitations
  FOR ALL USING (public.is_cohort_manager(cohort_id, auth.uid()));

CREATE POLICY "cohort_invitations_mentor_insert" ON public.cohort_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
      AND u.role = 'mentor'
    )
    AND public.is_cohort_member(cohort_id, auth.uid())
  );

CREATE POLICY "cohort_invitations_self_select" ON public.cohort_invitations
  FOR SELECT USING (invited_by = auth.uid() OR user_id = auth.uid());


-- COHORT_READ_STATUS TABLE
CREATE POLICY "cohort_read_status_self_all" ON public.cohort_read_status
  FOR ALL USING (user_id = auth.uid());


-- =====================================================
-- Refresh schema cache
-- =====================================================
NOTIFY pgrst, 'reload schema';
