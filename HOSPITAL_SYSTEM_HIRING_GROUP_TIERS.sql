-- Hospital System and Hiring Group tiers: roles, assignments, and system checklist.
-- Run in Supabase SQL Editor. Requires: users, hospitals (with hospital_system column).
--
-- If you get "ALTER TYPE ... ADD VALUE cannot run inside a transaction block", run these two lines first (one at a time, no DO block):
--   ALTER TYPE public.user_role ADD VALUE 'hospital_system';
--   ALTER TYPE public.user_role ADD VALUE 'hiring_group';

-- 1. Add new role values to user_role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'hospital_system' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE public.user_role ADD VALUE 'hospital_system';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already exists
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'hiring_group' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE public.user_role ADD VALUE 'hiring_group';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Hospital System assignments: which user can see which hospital system(s)
CREATE TABLE IF NOT EXISTS public.hospital_system_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_system_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, hospital_system_name)
);
CREATE INDEX IF NOT EXISTS idx_hospital_system_assignments_user ON public.hospital_system_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_hospital_system_assignments_system ON public.hospital_system_assignments(hospital_system_name);

ALTER TABLE public.hospital_system_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own hospital system assignments" ON public.hospital_system_assignments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage hospital system assignments" ON public.hospital_system_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- 3. Hiring Group assignments: which user can view snapshots for which hospital system(s)
CREATE TABLE IF NOT EXISTS public.hiring_group_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_system_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, hospital_system_name)
);
CREATE INDEX IF NOT EXISTS idx_hiring_group_assignments_user ON public.hiring_group_assignments(user_id);

ALTER TABLE public.hiring_group_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own hiring group assignments" ON public.hiring_group_assignments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage hiring group assignments" ON public.hiring_group_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- 4. Hospital system checklist (7 steps) – one row per system per step
CREATE TABLE IF NOT EXISTS public.hospital_system_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_system_name TEXT NOT NULL,
  step_number INTEGER NOT NULL CHECK (step_number >= 1 AND step_number <= 7),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id),
  UNIQUE(hospital_system_name, step_number)
);
CREATE INDEX IF NOT EXISTS idx_hospital_system_checklist_system ON public.hospital_system_checklist(hospital_system_name);

ALTER TABLE public.hospital_system_checklist ENABLE ROW LEVEL SECURITY;

-- Hospital system users can view/update checklist for their assigned systems only
CREATE POLICY "Hospital system users manage own system checklist" ON public.hospital_system_checklist
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.hospital_system_assignments hsa
      WHERE hsa.hospital_system_name = hospital_system_checklist.hospital_system_name
      AND hsa.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins manage hospital system checklist" ON public.hospital_system_checklist
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- 5. RLS: Hospital system users can read hospitals that belong to their assigned system(s)
-- (Existing hospitals policies may allow SELECT for is_active; we add a policy so hospital_system role can see by hospital_system)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hospitals' AND policyname = 'Hospital system users view assigned systems hospitals'
  ) THEN
    CREATE POLICY "Hospital system users view assigned systems hospitals" ON public.hospitals
      FOR SELECT USING (
        hospital_system IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.hospital_system_assignments hsa
          WHERE hsa.hospital_system_name = hospitals.hospital_system
          AND hsa.user_id = auth.uid()
        )
      );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Hiring group: same read-only access to hospitals in their assigned systems (for snapshot view)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hospitals' AND policyname = 'Hiring group users view assigned systems hospitals'
  ) THEN
    CREATE POLICY "Hiring group users view assigned systems hospitals" ON public.hospitals
      FOR SELECT USING (
        hospital_system IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.hiring_group_assignments hga
          WHERE hga.hospital_system_name = hospitals.hospital_system
          AND hga.user_id = auth.uid()
        )
      );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.hospital_system_assignments IS 'Assigns hospital_system role users to one or more hospital system names (matches hospitals.hospital_system).';
COMMENT ON TABLE public.hiring_group_assignments IS 'Assigns hiring_group role users to hospital systems for read-only snapshot view.';
COMMENT ON TABLE public.hospital_system_checklist IS '7-step pediatric readiness checklist progress per hospital system.';
