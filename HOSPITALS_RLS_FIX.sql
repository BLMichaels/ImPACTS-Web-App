-- Hospitals RLS Fix
-- Run this in your Supabase SQL Editor to fix INSERT permissions for hospitals

-- =====================================================
-- 1. Drop existing policies that might conflict
-- =====================================================

DROP POLICY IF EXISTS "Admins/Managers manage hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_admin_all" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_manager_all" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_insert" ON public.hospitals;


-- =====================================================
-- 2. Create proper RLS policies with WITH CHECK for inserts
-- =====================================================

-- Admins can do everything
CREATE POLICY "hospitals_admin_all" ON public.hospitals
  FOR ALL 
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Managers can do everything  
CREATE POLICY "hospitals_manager_all" ON public.hospitals
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'manager'
    )
  );


-- =====================================================
-- 3. Ensure is_admin_user function exists (for admins with is_admin flag)
-- =====================================================

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
-- 4. Verify the policies
-- =====================================================

-- Check existing policies on hospitals
-- SELECT * FROM pg_policies WHERE tablename = 'hospitals';


-- =====================================================
-- 5. Refresh schema cache
-- =====================================================

NOTIFY pgrst, 'reload schema';


-- =====================================================
-- VERIFICATION: Try inserting a test hospital (optional)
-- =====================================================
-- INSERT INTO public.hospitals (name, state) VALUES ('Test Hospital', 'XX');
-- DELETE FROM public.hospitals WHERE name = 'Test Hospital';
