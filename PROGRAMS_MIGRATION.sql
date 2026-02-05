-- Programs Feature Migration
-- Run this in your Supabase SQL Editor to create the programs tables
-- Programs are higher-level groupings that users can belong to

-- =====================================================
-- 1. Create programs table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_programs_is_active ON public.programs(is_active);
CREATE INDEX IF NOT EXISTS idx_programs_created_by ON public.programs(created_by);

-- Enable Row Level Security
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 2. Create program_members table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.program_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'removed')),
  added_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(program_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_program_members_program_id ON public.program_members(program_id);
CREATE INDEX IF NOT EXISTS idx_program_members_user_id ON public.program_members(user_id);
CREATE INDEX IF NOT EXISTS idx_program_members_status ON public.program_members(status);

-- Enable Row Level Security
ALTER TABLE public.program_members ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 3. Create program_managers table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.program_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(program_id, manager_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_program_managers_program_id ON public.program_managers(program_id);
CREATE INDEX IF NOT EXISTS idx_program_managers_manager_id ON public.program_managers(manager_id);

-- Enable Row Level Security
ALTER TABLE public.program_managers ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 4. Create program_announcements table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.program_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_program_announcements_program_id ON public.program_announcements(program_id);
CREATE INDEX IF NOT EXISTS idx_program_announcements_is_pinned ON public.program_announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_program_announcements_created_at ON public.program_announcements(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.program_announcements ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 5. Helper functions for RLS (SECURITY DEFINER to avoid recursion)
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_program_member(p_program_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.program_members
    WHERE program_id = p_program_id 
    AND user_id = p_user_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_program_manager(p_program_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.program_managers
    WHERE program_id = p_program_id 
    AND manager_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 6. RLS Policies for programs table
-- =====================================================

CREATE POLICY "programs_admin_all" ON public.programs
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "programs_manager_all" ON public.programs
  FOR ALL USING (public.is_program_manager(id, auth.uid()));

CREATE POLICY "programs_member_select" ON public.programs
  FOR SELECT USING (public.is_program_member(id, auth.uid()));


-- =====================================================
-- 7. RLS Policies for program_members table
-- =====================================================

CREATE POLICY "program_members_admin_all" ON public.program_members
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "program_members_manager_all" ON public.program_members
  FOR ALL USING (public.is_program_manager(program_id, auth.uid()));

CREATE POLICY "program_members_member_select" ON public.program_members
  FOR SELECT USING (public.is_program_member(program_id, auth.uid()));


-- =====================================================
-- 8. RLS Policies for program_managers table
-- =====================================================

CREATE POLICY "program_managers_admin_all" ON public.program_managers
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "program_managers_self_select" ON public.program_managers
  FOR SELECT USING (manager_id = auth.uid());


-- =====================================================
-- 9. RLS Policies for program_announcements table
-- =====================================================

CREATE POLICY "program_announcements_admin_all" ON public.program_announcements
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "program_announcements_manager_all" ON public.program_announcements
  FOR ALL USING (public.is_program_manager(program_id, auth.uid()));

CREATE POLICY "program_announcements_member_select" ON public.program_announcements
  FOR SELECT USING (public.is_program_member(program_id, auth.uid()));


-- =====================================================
-- 10. Trigger to update program updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_program_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_programs_updated_at ON public.programs;
CREATE TRIGGER trigger_programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_program_updated_at();


-- =====================================================
-- 11. Grant permissions
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_managers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_announcements TO authenticated;


-- =====================================================
-- 12. Refresh schema cache
-- =====================================================

NOTIFY pgrst, 'reload schema';


-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT * FROM public.programs LIMIT 1;
-- SELECT * FROM public.program_members LIMIT 1;
-- SELECT * FROM public.program_managers LIMIT 1;
-- SELECT * FROM public.program_announcements LIMIT 1;
