-- Granular Permissions Migration
-- Allows admins and managers to set permissions/views/tabs for specific users, cohorts, and programs
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. Allow PECC users to have manager_id (direct Manager-PECC assignment)
-- =====================================================

-- Add manager_id support for PECC users (currently only mentors can have manager_id)
-- Note: This allows PECCs to be assigned directly to managers, bypassing mentors
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS manager_id_for_pecc UUID REFERENCES public.users(id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_manager_id_for_pecc ON public.users(manager_id_for_pecc);

-- Update existing logic: if a PECC has manager_id_for_pecc, they're directly managed by that manager
-- (mentor_id can still exist for backward compatibility, but manager_id_for_pecc takes precedence)


-- =====================================================
-- 2. Create user_permissions table (per-user permission overrides)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES public.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_key ON public.user_permissions(permission_key);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own permissions
CREATE POLICY "Users view own permissions" ON public.user_permissions
  FOR SELECT USING (user_id = auth.uid());

-- Admins can manage all user permissions
CREATE POLICY "Admins manage user permissions" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

-- Managers can manage permissions for their direct reports (mentors and PECCs)
CREATE POLICY "Managers manage team permissions" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'manager'
      AND (
        -- Managing a mentor assigned to this manager
        EXISTS (SELECT 1 FROM public.users target WHERE target.id = user_permissions.user_id AND target.role = 'mentor' AND target.manager_id = u.id)
        OR
        -- Managing a PECC assigned directly to this manager
        EXISTS (SELECT 1 FROM public.users target WHERE target.id = user_permissions.user_id AND target.role = 'pecc' AND target.manager_id_for_pecc = u.id)
        OR
        -- Managing a PECC assigned to a mentor under this manager
        EXISTS (
          SELECT 1 FROM public.users target 
          JOIN public.users mentor ON mentor.id = target.mentor_id
          WHERE target.id = user_permissions.user_id 
          AND target.role = 'pecc' 
          AND mentor.manager_id = u.id
        )
      )
    )
  );


-- =====================================================
-- 3. Create cohort_permissions table (per-cohort permissions)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cohort_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role user_role,  -- If set, applies to all users with this role in the cohort
  permission_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES public.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Either user_id or role must be set, but not both
  CONSTRAINT cohort_permissions_user_or_role CHECK (
    (user_id IS NOT NULL AND role IS NULL) OR 
    (user_id IS NULL AND role IS NOT NULL)
  ),
  -- Unique constraint: one permission per user+cohort or role+cohort
  UNIQUE(cohort_id, user_id, permission_key),
  UNIQUE(cohort_id, role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_cohort_permissions_cohort_id ON public.cohort_permissions(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_permissions_user_id ON public.cohort_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_cohort_permissions_role ON public.cohort_permissions(role);

ALTER TABLE public.cohort_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view permissions for cohorts they're members of
CREATE POLICY "Users view cohort permissions" ON public.cohort_permissions
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.cohort_members cm 
      WHERE cm.cohort_id = cohort_permissions.cohort_id 
      AND cm.user_id = auth.uid() 
      AND cm.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
      AND u.role = cohort_permissions.role
      AND EXISTS (
        SELECT 1 FROM public.cohort_members cm 
        WHERE cm.cohort_id = cohort_permissions.cohort_id 
        AND cm.user_id = auth.uid() 
        AND cm.status = 'active'
      )
    )
  );

-- Admins can manage all cohort permissions
CREATE POLICY "Admins manage cohort permissions" ON public.cohort_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

-- Managers can manage permissions for cohorts they manage
CREATE POLICY "Managers manage cohort permissions" ON public.cohort_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cohort_managers cm 
      WHERE cm.cohort_id = cohort_permissions.cohort_id 
      AND cm.manager_id = auth.uid()
    )
  );


-- =====================================================
-- 4. Create program_permissions table (per-program permissions)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.program_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role user_role,  -- If set, applies to all users with this role in the program
  permission_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES public.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Either user_id or role must be set, but not both
  CONSTRAINT program_permissions_user_or_role CHECK (
    (user_id IS NOT NULL AND role IS NULL) OR 
    (user_id IS NULL AND role IS NOT NULL)
  ),
  -- Unique constraint: one permission per user+program or role+program
  UNIQUE(program_id, user_id, permission_key),
  UNIQUE(program_id, role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_program_permissions_program_id ON public.program_permissions(program_id);
CREATE INDEX IF NOT EXISTS idx_program_permissions_user_id ON public.program_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_program_permissions_role ON public.program_permissions(role);

ALTER TABLE public.program_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view permissions for programs they're members of
CREATE POLICY "Users view program permissions" ON public.program_permissions
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.program_members pm 
      WHERE pm.program_id = program_permissions.program_id 
      AND pm.user_id = auth.uid() 
      AND pm.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
      AND u.role = program_permissions.role
      AND EXISTS (
        SELECT 1 FROM public.program_members pm 
        WHERE pm.program_id = program_permissions.program_id 
        AND pm.user_id = auth.uid() 
        AND pm.status = 'active'
      )
    )
  );

-- Admins can manage all program permissions
CREATE POLICY "Admins manage program permissions" ON public.program_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

-- Managers can manage permissions for programs they manage
CREATE POLICY "Managers manage program permissions" ON public.program_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.program_managers pm 
      WHERE pm.program_id = program_permissions.program_id 
      AND pm.manager_id = auth.uid()
    )
  );


-- =====================================================
-- 5. Create view_tabs table (for tab visibility control)
-- =====================================================
-- This allows granular control over which tabs/views are visible to users

CREATE TABLE IF NOT EXISTS public.view_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Scope: what this applies to
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  
  -- Tab/view identifier (e.g., 'announcements', 'discussions', 'members', 'activities', etc.)
  tab_key TEXT NOT NULL,
  
  -- Visibility
  is_visible BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  granted_by UUID REFERENCES public.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Exactly one scope must be set
  CONSTRAINT view_tabs_one_scope CHECK (
    (user_id IS NOT NULL AND cohort_id IS NULL AND program_id IS NULL) OR
    (user_id IS NULL AND cohort_id IS NOT NULL AND program_id IS NULL) OR
    (user_id IS NULL AND cohort_id IS NULL AND program_id IS NOT NULL)
  )
);

-- Create partial unique indexes for conditional uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_view_tabs_user_tab_unique 
ON public.view_tabs(user_id, tab_key) 
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_view_tabs_cohort_tab_unique 
ON public.view_tabs(cohort_id, tab_key) 
WHERE cohort_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_view_tabs_program_tab_unique 
ON public.view_tabs(program_id, tab_key) 
WHERE program_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_view_tabs_user_id ON public.view_tabs(user_id);
CREATE INDEX IF NOT EXISTS idx_view_tabs_cohort_id ON public.view_tabs(cohort_id);
CREATE INDEX IF NOT EXISTS idx_view_tabs_program_id ON public.view_tabs(program_id);
CREATE INDEX IF NOT EXISTS idx_view_tabs_tab_key ON public.view_tabs(tab_key);

ALTER TABLE public.view_tabs ENABLE ROW LEVEL SECURITY;

-- Users can view their own tab settings
CREATE POLICY "Users view own tabs" ON public.view_tabs
  FOR SELECT USING (user_id = auth.uid());

-- Users can view tab settings for cohorts/programs they're members of
CREATE POLICY "Users view cohort program tabs" ON public.view_tabs
  FOR SELECT USING (
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

-- Admins can manage all tab settings
CREATE POLICY "Admins manage tabs" ON public.view_tabs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_admin = true)
    )
  );

-- Managers can manage tabs for their team members
CREATE POLICY "Managers manage team tabs" ON public.view_tabs
  FOR ALL USING (
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


-- =====================================================
-- 6. Helper function to check if a user has a permission
-- =====================================================

CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_permission_key TEXT,
  p_cohort_id UUID DEFAULT NULL,
  p_program_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role user_role;
  v_has_permission BOOLEAN;
BEGIN
  -- Get user's role
  SELECT role INTO v_user_role FROM public.users WHERE id = p_user_id;
  
  -- Check role-based permissions first (from role_permissions table)
  SELECT is_enabled INTO v_has_permission
  FROM public.role_permissions
  WHERE role = v_user_role AND permission_key = p_permission_key;
  
  -- If no role permission found, default to false
  IF v_has_permission IS NULL THEN
    v_has_permission := false;
  END IF;
  
  -- Override with user-specific permission if exists
  IF EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = p_user_id AND permission_key = p_permission_key) THEN
    SELECT is_enabled INTO v_has_permission
    FROM public.user_permissions
    WHERE user_id = p_user_id AND permission_key = p_permission_key;
  END IF;
  
  -- Override with cohort-specific permission if provided
  IF p_cohort_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.cohort_permissions 
      WHERE cohort_id = p_cohort_id 
      AND (user_id = p_user_id OR role = v_user_role)
      AND permission_key = p_permission_key
    ) THEN
      SELECT is_enabled INTO v_has_permission
      FROM public.cohort_permissions
      WHERE cohort_id = p_cohort_id 
      AND (user_id = p_user_id OR role = v_user_role)
      AND permission_key = p_permission_key
      ORDER BY CASE WHEN user_id IS NOT NULL THEN 0 ELSE 1 END  -- Prefer user-specific over role-based
      LIMIT 1;
    END IF;
  END IF;
  
  -- Override with program-specific permission if provided
  IF p_program_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.program_permissions 
      WHERE program_id = p_program_id 
      AND (user_id = p_user_id OR role = v_user_role)
      AND permission_key = p_permission_key
    ) THEN
      SELECT is_enabled INTO v_has_permission
      FROM public.program_permissions
      WHERE program_id = p_program_id 
      AND (user_id = p_user_id OR role = v_user_role)
      AND permission_key = p_permission_key
      ORDER BY CASE WHEN user_id IS NOT NULL THEN 0 ELSE 1 END  -- Prefer user-specific over role-based
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 7. Helper function to check if a tab is visible
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_tab_visible(
  p_user_id UUID,
  p_tab_key TEXT,
  p_cohort_id UUID DEFAULT NULL,
  p_program_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_visible BOOLEAN;
BEGIN
  -- Check user-specific tab setting
  IF EXISTS (SELECT 1 FROM public.view_tabs WHERE user_id = p_user_id AND tab_key = p_tab_key) THEN
    SELECT is_visible INTO v_is_visible
    FROM public.view_tabs
    WHERE user_id = p_user_id AND tab_key = p_tab_key;
    RETURN v_is_visible;
  END IF;
  
  -- Check cohort-specific tab setting
  IF p_cohort_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.view_tabs WHERE cohort_id = p_cohort_id AND tab_key = p_tab_key
  ) THEN
    SELECT is_visible INTO v_is_visible
    FROM public.view_tabs
    WHERE cohort_id = p_cohort_id AND tab_key = p_tab_key;
    RETURN v_is_visible;
  END IF;
  
  -- Check program-specific tab setting
  IF p_program_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.view_tabs WHERE program_id = p_program_id AND tab_key = p_tab_key
  ) THEN
    SELECT is_visible INTO v_is_visible
    FROM public.view_tabs
    WHERE program_id = p_program_id AND tab_key = p_tab_key;
    RETURN v_is_visible;
  END IF;
  
  -- Default: tab is visible if no override exists
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- VERIFICATION
-- =====================================================
-- Run these queries to verify the migration:

-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%manager%';
-- SELECT * FROM information_schema.tables WHERE table_name IN ('user_permissions', 'cohort_permissions', 'program_permissions', 'view_tabs');
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('user_has_permission', 'is_tab_visible');
