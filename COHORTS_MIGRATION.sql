-- Cohorts Feature Migration
-- Run this in your Supabase SQL Editor to create the cohorts tables
-- This enables grouping users into cohorts with announcements and discussions

-- =====================================================
-- 1. Create cohorts table
-- =====================================================
-- Main cohorts table storing cohort metadata

CREATE TABLE IF NOT EXISTS public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  program_id TEXT,  -- Optional link to a program (stored as text for flexibility)
  created_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cohorts_is_active ON public.cohorts(is_active);
CREATE INDEX IF NOT EXISTS idx_cohorts_program_id ON public.cohorts(program_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_created_by ON public.cohorts(created_by);

-- Enable Row Level Security
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 2. Create cohort_members table
-- =====================================================
-- Junction table for cohort membership

CREATE TABLE IF NOT EXISTS public.cohort_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending_approval', 'removed')),
  added_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure a user can only be in a cohort once
  UNIQUE(cohort_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort_id ON public.cohort_members(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_user_id ON public.cohort_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_status ON public.cohort_members(status);

-- Enable Row Level Security
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 3. Create cohort_managers table
-- =====================================================
-- Which managers can manage which cohorts

CREATE TABLE IF NOT EXISTS public.cohort_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure a manager is only assigned to a cohort once
  UNIQUE(cohort_id, manager_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cohort_managers_cohort_id ON public.cohort_managers(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_managers_manager_id ON public.cohort_managers(manager_id);

-- Enable Row Level Security
ALTER TABLE public.cohort_managers ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 4. Create cohort_announcements table
-- =====================================================
-- Announcements posted by admins/managers to cohorts

CREATE TABLE IF NOT EXISTS public.cohort_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cohort_announcements_cohort_id ON public.cohort_announcements(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_announcements_is_pinned ON public.cohort_announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_cohort_announcements_created_at ON public.cohort_announcements(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.cohort_announcements ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 5. Create cohort_discussion_topics table
-- =====================================================
-- Discussion thread topics within cohorts

CREATE TABLE IF NOT EXISTS public.cohort_discussion_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,  -- Optional initial post content
  created_by UUID REFERENCES public.users(id),
  is_locked BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  reply_count INTEGER DEFAULT 0,
  last_reply_at TIMESTAMPTZ,
  last_reply_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cohort_discussion_topics_cohort_id ON public.cohort_discussion_topics(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_discussion_topics_is_pinned ON public.cohort_discussion_topics(is_pinned);
CREATE INDEX IF NOT EXISTS idx_cohort_discussion_topics_last_reply_at ON public.cohort_discussion_topics(last_reply_at DESC);
CREATE INDEX IF NOT EXISTS idx_cohort_discussion_topics_created_at ON public.cohort_discussion_topics(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.cohort_discussion_topics ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 6. Create cohort_discussion_replies table
-- =====================================================
-- Replies within discussion topics

CREATE TABLE IF NOT EXISTS public.cohort_discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.cohort_discussion_topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cohort_discussion_replies_topic_id ON public.cohort_discussion_replies(topic_id);
CREATE INDEX IF NOT EXISTS idx_cohort_discussion_replies_created_at ON public.cohort_discussion_replies(created_at);

-- Enable Row Level Security
ALTER TABLE public.cohort_discussion_replies ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 7. Create cohort_invitations table
-- =====================================================
-- Pending invitations (for mentor-initiated invites that need approval)

CREATE TABLE IF NOT EXISTS public.cohort_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate pending invitations
  UNIQUE(cohort_id, user_id, status)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cohort_invitations_cohort_id ON public.cohort_invitations(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_invitations_user_id ON public.cohort_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_cohort_invitations_status ON public.cohort_invitations(status);
CREATE INDEX IF NOT EXISTS idx_cohort_invitations_invited_by ON public.cohort_invitations(invited_by);

-- Enable Row Level Security
ALTER TABLE public.cohort_invitations ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 8. Create read tracking table for unread indicators
-- =====================================================
-- Track last read timestamps per user per cohort

CREATE TABLE IF NOT EXISTS public.cohort_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  last_read_announcements TIMESTAMPTZ,
  last_read_discussions TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, cohort_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cohort_read_status_user_id ON public.cohort_read_status(user_id);
CREATE INDEX IF NOT EXISTS idx_cohort_read_status_cohort_id ON public.cohort_read_status(cohort_id);

-- Enable Row Level Security
ALTER TABLE public.cohort_read_status ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 9. RLS Policies for cohorts table
-- =====================================================

-- Admins can do everything
DROP POLICY IF EXISTS "Admins full access to cohorts" ON public.cohorts;
CREATE POLICY "Admins full access to cohorts" ON public.cohorts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.is_admin = true)
    )
  );

-- Managers can manage cohorts they're assigned to
DROP POLICY IF EXISTS "Managers manage assigned cohorts" ON public.cohorts;
CREATE POLICY "Managers manage assigned cohorts" ON public.cohorts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cohort_managers cm
      JOIN public.users u ON u.id = auth.uid()
      WHERE cm.cohort_id = cohorts.id 
      AND cm.manager_id = auth.uid()
      AND u.role = 'manager'
    )
  );

-- Members can view cohorts they belong to
DROP POLICY IF EXISTS "Members view their cohorts" ON public.cohorts;
CREATE POLICY "Members view their cohorts" ON public.cohorts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohorts.id 
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );


-- =====================================================
-- 10. RLS Policies for cohort_members table
-- =====================================================

-- Admins can do everything
DROP POLICY IF EXISTS "Admins full access to cohort_members" ON public.cohort_members;
CREATE POLICY "Admins full access to cohort_members" ON public.cohort_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.is_admin = true)
    )
  );

-- Managers can manage members in their cohorts
DROP POLICY IF EXISTS "Managers manage cohort members" ON public.cohort_members;
CREATE POLICY "Managers manage cohort members" ON public.cohort_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cohort_managers cm
      WHERE cm.cohort_id = cohort_members.cohort_id 
      AND cm.manager_id = auth.uid()
    )
  );

-- Members can view other members in their cohorts
DROP POLICY IF EXISTS "Members view cohort members" ON public.cohort_members;
CREATE POLICY "Members view cohort members" ON public.cohort_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members my_membership
      WHERE my_membership.cohort_id = cohort_members.cohort_id 
      AND my_membership.user_id = auth.uid()
      AND my_membership.status = 'active'
    )
  );


-- =====================================================
-- 11. RLS Policies for cohort_managers table
-- =====================================================

-- Admins can do everything
DROP POLICY IF EXISTS "Admins full access to cohort_managers" ON public.cohort_managers;
CREATE POLICY "Admins full access to cohort_managers" ON public.cohort_managers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.is_admin = true)
    )
  );

-- Managers can view their own assignments
DROP POLICY IF EXISTS "Managers view own assignments" ON public.cohort_managers;
CREATE POLICY "Managers view own assignments" ON public.cohort_managers
  FOR SELECT USING (manager_id = auth.uid());


-- =====================================================
-- 12. RLS Policies for cohort_announcements table
-- =====================================================

-- Admins can do everything
DROP POLICY IF EXISTS "Admins full access to cohort_announcements" ON public.cohort_announcements;
CREATE POLICY "Admins full access to cohort_announcements" ON public.cohort_announcements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.is_admin = true)
    )
  );

-- Managers can manage announcements in their cohorts
DROP POLICY IF EXISTS "Managers manage cohort announcements" ON public.cohort_announcements;
CREATE POLICY "Managers manage cohort announcements" ON public.cohort_announcements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cohort_managers cm
      WHERE cm.cohort_id = cohort_announcements.cohort_id 
      AND cm.manager_id = auth.uid()
    )
  );

-- Members can view announcements in their cohorts
DROP POLICY IF EXISTS "Members view cohort announcements" ON public.cohort_announcements;
CREATE POLICY "Members view cohort announcements" ON public.cohort_announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_announcements.cohort_id 
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );


-- =====================================================
-- 13. RLS Policies for cohort_discussion_topics table
-- =====================================================

-- Admins can do everything
DROP POLICY IF EXISTS "Admins full access to discussion_topics" ON public.cohort_discussion_topics;
CREATE POLICY "Admins full access to discussion_topics" ON public.cohort_discussion_topics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.is_admin = true)
    )
  );

-- Managers can manage topics in their cohorts
DROP POLICY IF EXISTS "Managers manage discussion topics" ON public.cohort_discussion_topics;
CREATE POLICY "Managers manage discussion topics" ON public.cohort_discussion_topics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cohort_managers cm
      WHERE cm.cohort_id = cohort_discussion_topics.cohort_id 
      AND cm.manager_id = auth.uid()
    )
  );

-- Members can view topics in their cohorts
DROP POLICY IF EXISTS "Members view discussion topics" ON public.cohort_discussion_topics;
CREATE POLICY "Members view discussion topics" ON public.cohort_discussion_topics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_discussion_topics.cohort_id 
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Members can create topics in their cohorts (if not locked)
DROP POLICY IF EXISTS "Members create discussion topics" ON public.cohort_discussion_topics;
CREATE POLICY "Members create discussion topics" ON public.cohort_discussion_topics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_discussion_topics.cohort_id 
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Members can update their own topics
DROP POLICY IF EXISTS "Members update own topics" ON public.cohort_discussion_topics;
CREATE POLICY "Members update own topics" ON public.cohort_discussion_topics
  FOR UPDATE USING (created_by = auth.uid());


-- =====================================================
-- 14. RLS Policies for cohort_discussion_replies table
-- =====================================================

-- Admins can do everything
DROP POLICY IF EXISTS "Admins full access to discussion_replies" ON public.cohort_discussion_replies;
CREATE POLICY "Admins full access to discussion_replies" ON public.cohort_discussion_replies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.is_admin = true)
    )
  );

-- Managers can manage replies in their cohorts
DROP POLICY IF EXISTS "Managers manage discussion replies" ON public.cohort_discussion_replies;
CREATE POLICY "Managers manage discussion replies" ON public.cohort_discussion_replies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cohort_discussion_topics t
      JOIN public.cohort_managers cm ON cm.cohort_id = t.cohort_id
      WHERE t.id = cohort_discussion_replies.topic_id 
      AND cm.manager_id = auth.uid()
    )
  );

-- Members can view replies in topics they can access
DROP POLICY IF EXISTS "Members view discussion replies" ON public.cohort_discussion_replies;
CREATE POLICY "Members view discussion replies" ON public.cohort_discussion_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cohort_discussion_topics t
      JOIN public.cohort_members cm ON cm.cohort_id = t.cohort_id
      WHERE t.id = cohort_discussion_replies.topic_id 
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Members can create replies in topics (if not locked)
DROP POLICY IF EXISTS "Members create discussion replies" ON public.cohort_discussion_replies;
CREATE POLICY "Members create discussion replies" ON public.cohort_discussion_replies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cohort_discussion_topics t
      JOIN public.cohort_members cm ON cm.cohort_id = t.cohort_id
      WHERE t.id = cohort_discussion_replies.topic_id 
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND t.is_locked = false
    )
  );

-- Members can update their own replies
DROP POLICY IF EXISTS "Members update own replies" ON public.cohort_discussion_replies;
CREATE POLICY "Members update own replies" ON public.cohort_discussion_replies
  FOR UPDATE USING (created_by = auth.uid());


-- =====================================================
-- 15. RLS Policies for cohort_invitations table
-- =====================================================

-- Admins can do everything
DROP POLICY IF EXISTS "Admins full access to cohort_invitations" ON public.cohort_invitations;
CREATE POLICY "Admins full access to cohort_invitations" ON public.cohort_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.is_admin = true)
    )
  );

-- Managers can manage invitations in their cohorts
DROP POLICY IF EXISTS "Managers manage cohort invitations" ON public.cohort_invitations;
CREATE POLICY "Managers manage cohort invitations" ON public.cohort_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cohort_managers cm
      WHERE cm.cohort_id = cohort_invitations.cohort_id 
      AND cm.manager_id = auth.uid()
    )
  );

-- Mentors can create invitations (insert only)
DROP POLICY IF EXISTS "Mentors create invitations" ON public.cohort_invitations;
CREATE POLICY "Mentors create invitations" ON public.cohort_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
      AND u.role = 'mentor'
    )
    AND
    EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_invitations.cohort_id 
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Users can view invitations they created or are invited to
DROP POLICY IF EXISTS "Users view own invitations" ON public.cohort_invitations;
CREATE POLICY "Users view own invitations" ON public.cohort_invitations
  FOR SELECT USING (
    invited_by = auth.uid() OR user_id = auth.uid()
  );


-- =====================================================
-- 16. RLS Policies for cohort_read_status table
-- =====================================================

-- Users can manage their own read status
DROP POLICY IF EXISTS "Users manage own read status" ON public.cohort_read_status;
CREATE POLICY "Users manage own read status" ON public.cohort_read_status
  FOR ALL USING (user_id = auth.uid());


-- =====================================================
-- 17. Trigger to update reply count and last reply info
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_topic_reply_stats()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_topic_reply_stats ON public.cohort_discussion_replies;
CREATE TRIGGER trigger_update_topic_reply_stats
  AFTER INSERT OR DELETE ON public.cohort_discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_topic_reply_stats();


-- =====================================================
-- 18. Trigger to update cohort updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_cohort_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cohorts_updated_at ON public.cohorts;
CREATE TRIGGER trigger_cohorts_updated_at
  BEFORE UPDATE ON public.cohorts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cohort_updated_at();


-- =====================================================
-- 19. Grant permissions to authenticated users
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohorts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_managers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_discussion_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_discussion_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_read_status TO authenticated;


-- =====================================================
-- 20. Refresh PostgREST schema cache
-- =====================================================

NOTIFY pgrst, 'reload schema';


-- =====================================================
-- VERIFICATION: Run these to confirm tables exist
-- =====================================================
-- SELECT * FROM public.cohorts LIMIT 1;
-- SELECT * FROM public.cohort_members LIMIT 1;
-- SELECT * FROM public.cohort_managers LIMIT 1;
-- SELECT * FROM public.cohort_announcements LIMIT 1;
-- SELECT * FROM public.cohort_discussion_topics LIMIT 1;
-- SELECT * FROM public.cohort_discussion_replies LIMIT 1;
-- SELECT * FROM public.cohort_invitations LIMIT 1;
-- SELECT * FROM public.cohort_read_status LIMIT 1;
