-- Site Members and Tab Visibility Migration
-- Run this in your Supabase SQL Editor to create the site management tables

-- =====================================================
-- 1. Create site_members table
-- This tracks which users belong to which sites/hospitals
-- =====================================================

CREATE TABLE IF NOT EXISTS public.site_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(site_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_site_members_site_id ON public.site_members(site_id);
CREATE INDEX IF NOT EXISTS idx_site_members_user_id ON public.site_members(user_id);

-- Enable Row Level Security
ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 2. Create site_tab_visibility table
-- This controls which tabs are visible for each site
-- =====================================================

CREATE TABLE IF NOT EXISTS public.site_tab_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL,
  tab_key TEXT NOT NULL,
  visible BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(site_id, tab_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_site_tab_visibility_site_id ON public.site_tab_visibility(site_id);

-- Enable Row Level Security
ALTER TABLE public.site_tab_visibility ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 3. RLS Policies for site_members
-- =====================================================

-- Admins can do everything
CREATE POLICY "site_members_admin_all" ON public.site_members
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- Managers can manage site members
CREATE POLICY "site_members_manager_all" ON public.site_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Users can see their own site memberships
CREATE POLICY "site_members_self_select" ON public.site_members
  FOR SELECT USING (user_id = auth.uid());


-- =====================================================
-- 4. RLS Policies for site_tab_visibility
-- =====================================================

-- Admins can do everything
CREATE POLICY "site_tab_visibility_admin_all" ON public.site_tab_visibility
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- Managers can manage tab visibility
CREATE POLICY "site_tab_visibility_manager_all" ON public.site_tab_visibility
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- All authenticated users can read tab visibility
CREATE POLICY "site_tab_visibility_select" ON public.site_tab_visibility
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- =====================================================
-- 5. Grant permissions
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_tab_visibility TO authenticated;


-- =====================================================
-- 6. Refresh schema cache
-- =====================================================

NOTIFY pgrst, 'reload schema';


-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT * FROM public.site_members LIMIT 1;
-- SELECT * FROM public.site_tab_visibility LIMIT 1;
