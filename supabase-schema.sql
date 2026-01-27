-- ImPACTS Web App - Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up all tables

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'mentor', 'pecc');
CREATE TYPE trauma_level AS ENUM ('Level I', 'Level II', 'Level III', 'Level IV', 'Critical Access', 'Non-Designated', 'Free-Standing ED');
CREATE TYPE contact_status AS ENUM ('ED Employee (general contact)', 'Pediatric Champion (NOT A PECC)', 'New PECC', 'Already a PECC');
CREATE TYPE activity_category AS ENUM ('PE', 'TR', 'AD', 'RA', 'SC', 'DM');
CREATE TYPE simulation_case AS ENUM ('Bronchiolitis/Respiratory Distress', 'Severe Head Trauma', 'Asthma/Child with a Wheeze', 'Newborn Resuscitation', 'Postpartum Hemorrhage', 'Scald Burn', 'Agitation', 'Vomiting Infant', 'Fussy Baby', 'Pediatric Trauma/Abdominal', 'Sick Neonate', 'Seizing Infant', 'Seizing Child', 'Anaphylaxis', 'Altered Mental Status', 'Other');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'paid');
CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'rejected', 'reimbursed');
CREATE TYPE milestone_status AS ENUM ('not_started', 'in_progress', 'completed', 'blocked');

-- ============================================
-- USERS TABLE (extends auth.users)
-- ============================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  role user_role NOT NULL DEFAULT 'pecc',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  manager_id UUID REFERENCES public.users(id),
  mentor_id UUID REFERENCES public.users(id)
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Admins and managers can view users
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- Mentors can view their PECCs
CREATE POLICY "Mentors can view their PECCs" ON public.users
  FOR SELECT USING (
    mentor_id = auth.uid()
  );

-- Users can update own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Admins can manage all users
CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ============================================
-- HOSPITALS TABLE
-- ============================================

CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  trauma_level trauma_level NOT NULL DEFAULT 'Non-Designated',
  ed_size TEXT,
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

-- Everyone can view active hospitals
CREATE POLICY "View active hospitals" ON public.hospitals
  FOR SELECT USING (is_active = true);

-- Admins and managers can manage hospitals
CREATE POLICY "Admins/Managers manage hospitals" ON public.hospitals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- ============================================
-- HOSPITAL CONTACTS TABLE (CRM)
-- ============================================

CREATE TABLE public.hospital_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  contact_status contact_status NOT NULL DEFAULT 'ED Employee (general contact)',
  role_at_hospital TEXT,
  is_primary_contact BOOLEAN NOT NULL DEFAULT false,
  is_actively_engaged BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hospital_contacts ENABLE ROW LEVEL SECURITY;

-- Mentors can view/manage contacts for their hospitals
CREATE POLICY "Mentors view their hospital contacts" ON public.hospital_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.mentor_hospital_assignments mha
      WHERE mha.hospital_id = hospital_contacts.hospital_id
      AND mha.mentor_id = auth.uid()
      AND mha.is_active = true
    )
  );

-- Admins/Managers can view all contacts
CREATE POLICY "Admins/Managers view all contacts" ON public.hospital_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- Admins/Managers/Mentors can manage contacts
CREATE POLICY "Manage contacts" ON public.hospital_contacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager', 'mentor')
    )
  );

-- ============================================
-- MENTOR-HOSPITAL ASSIGNMENTS
-- ============================================

CREATE TABLE public.mentor_hospital_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID NOT NULL REFERENCES public.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(mentor_id, hospital_id)
);

ALTER TABLE public.mentor_hospital_assignments ENABLE ROW LEVEL SECURITY;

-- Mentors can view their own assignments
CREATE POLICY "Mentors view own assignments" ON public.mentor_hospital_assignments
  FOR SELECT USING (mentor_id = auth.uid());

-- Admins/Managers can manage assignments
CREATE POLICY "Admins/Managers manage assignments" ON public.mentor_hospital_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- ============================================
-- INVITATIONS TABLE
-- ============================================

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  hospital_id UUID REFERENCES public.hospitals(id),
  mentor_id UUID REFERENCES public.users(id),
  manager_id UUID REFERENCES public.users(id),
  invited_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations they created
CREATE POLICY "View own invitations" ON public.invitations
  FOR SELECT USING (invited_by = auth.uid());

-- Admins/Managers can view all invitations
CREATE POLICY "Admins/Managers view invitations" ON public.invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- Allow creating invitations
CREATE POLICY "Create invitations" ON public.invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager', 'mentor')
    )
  );

-- Public read for invitation acceptance (by code)
CREATE POLICY "Public read for acceptance" ON public.invitations
  FOR SELECT USING (status = 'pending');

-- ============================================
-- MENTOR ACTIVITIES TABLE
-- ============================================

CREATE TABLE public.mentor_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  activity_name TEXT NOT NULL,
  category activity_category NOT NULL,
  hours DECIMAL(4,2) NOT NULL CHECK (hours >= 0 AND hours <= 10),
  description TEXT,
  hospital_ids UUID[] NOT NULL DEFAULT '{}',
  simulation_case simulation_case,
  sim_participants INTEGER CHECK (sim_participants >= 1 AND sim_participants <= 25),
  facilitator_feedback_submitted BOOLEAN DEFAULT false,
  participant_feedback_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mentor_activities ENABLE ROW LEVEL SECURITY;

-- Mentors can manage their own activities
CREATE POLICY "Mentors manage own activities" ON public.mentor_activities
  FOR ALL USING (mentor_id = auth.uid());

-- Managers can view their mentors' activities
CREATE POLICY "Managers view team activities" ON public.mentor_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = mentor_activities.mentor_id 
      AND u.manager_id = auth.uid()
    )
  );

-- Admins can view all activities
CREATE POLICY "Admins view all activities" ON public.mentor_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ============================================
-- PECC ACTIVITIES TABLE
-- ============================================

CREATE TABLE public.pecc_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pecc_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES public.hospitals(id),
  date DATE NOT NULL,
  activity_type TEXT NOT NULL,
  hours DECIMAL(4,2) NOT NULL CHECK (hours >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pecc_activities ENABLE ROW LEVEL SECURITY;

-- PECCs can manage their own activities
CREATE POLICY "PECCs manage own activities" ON public.pecc_activities
  FOR ALL USING (pecc_id = auth.uid());

-- Mentors can view their PECCs' activities
CREATE POLICY "Mentors view PECC activities" ON public.pecc_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = pecc_activities.pecc_id 
      AND u.mentor_id = auth.uid()
    )
  );

-- Managers/Admins can view all PECC activities
CREATE POLICY "Managers/Admins view PECC activities" ON public.pecc_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- ============================================
-- ROLE PERMISSIONS TABLE
-- ============================================

CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  permission_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can read permissions
CREATE POLICY "Read permissions" ON public.role_permissions
  FOR SELECT USING (true);

-- Only admins can modify permissions
CREATE POLICY "Admins manage permissions" ON public.role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ============================================
-- WAGES TABLE
-- ============================================

CREATE TABLE public.wage_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  hours_worked DECIMAL(6,2) NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(8,2) NOT NULL DEFAULT 0,
  stipend_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) GENERATED ALWAYS AS (hours_worked * hourly_rate + stipend_amount) STORED,
  status payment_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wage_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own wages
CREATE POLICY "View own wages" ON public.wage_entries
  FOR SELECT USING (user_id = auth.uid());

-- Managers can view/manage their team's wages
CREATE POLICY "Managers manage team wages" ON public.wage_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = wage_entries.user_id 
      AND u.manager_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ============================================
-- EXPENSES TABLE
-- ============================================

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  receipt_url TEXT,
  status expense_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Users can manage their own expenses
CREATE POLICY "Manage own expenses" ON public.expenses
  FOR ALL USING (user_id = auth.uid());

-- Managers/Admins can view/approve expenses
CREATE POLICY "Managers/Admins manage expenses" ON public.expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- ============================================
-- SITE MILESTONES TABLE
-- ============================================

CREATE TABLE public.site_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  milestone_name TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  completed_date DATE,
  status milestone_status NOT NULL DEFAULT 'not_started',
  assigned_to UUID REFERENCES public.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.site_milestones ENABLE ROW LEVEL SECURITY;

-- Mentors can view/manage milestones for their hospitals
CREATE POLICY "Mentors manage hospital milestones" ON public.site_milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.mentor_hospital_assignments mha
      WHERE mha.hospital_id = site_milestones.hospital_id
      AND mha.mentor_id = auth.uid()
      AND mha.is_active = true
    )
  );

-- Admins/Managers can manage all milestones
CREATE POLICY "Admins/Managers manage milestones" ON public.site_milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_hospital_contacts_updated_at BEFORE UPDATE ON public.hospital_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_mentor_activities_updated_at BEFORE UPDATE ON public.mentor_activities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pecc_activities_updated_at BEFORE UPDATE ON public.pecc_activities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_wage_entries_updated_at BEFORE UPDATE ON public.wage_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_site_milestones_updated_at BEFORE UPDATE ON public.site_milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to generate unique invitation code
CREATE OR REPLACE FUNCTION generate_invitation_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_manager_id ON public.users(manager_id);
CREATE INDEX idx_users_mentor_id ON public.users(mentor_id);
CREATE INDEX idx_hospital_contacts_hospital_id ON public.hospital_contacts(hospital_id);
CREATE INDEX idx_mentor_hospital_assignments_mentor_id ON public.mentor_hospital_assignments(mentor_id);
CREATE INDEX idx_mentor_hospital_assignments_hospital_id ON public.mentor_hospital_assignments(hospital_id);
CREATE INDEX idx_mentor_activities_mentor_id ON public.mentor_activities(mentor_id);
CREATE INDEX idx_mentor_activities_date ON public.mentor_activities(date);
CREATE INDEX idx_pecc_activities_pecc_id ON public.pecc_activities(pecc_id);
CREATE INDEX idx_pecc_activities_date ON public.pecc_activities(date);
CREATE INDEX idx_invitations_code ON public.invitations(code);
CREATE INDEX idx_invitations_status ON public.invitations(status);
CREATE INDEX idx_site_milestones_hospital_id ON public.site_milestones(hospital_id);

-- ============================================
-- INITIAL DATA: Default permissions
-- ============================================

-- Insert default permissions for each role
INSERT INTO public.role_permissions (role, permission_key, is_enabled) VALUES
-- Admin permissions (all enabled)
('admin', 'view_dashboard', true),
('admin', 'view_aggregated_data', true),
('admin', 'view_own_activities', true),
('admin', 'view_team_activities', true),
('admin', 'view_all_activities', true),
('admin', 'manage_own_activities', true),
('admin', 'view_own_hospitals', true),
('admin', 'view_all_hospitals', true),
('admin', 'manage_hospitals', true),
('admin', 'view_contacts', true),
('admin', 'manage_contacts', true),
('admin', 'view_users', true),
('admin', 'manage_users', true),
('admin', 'send_invitations', true),
('admin', 'view_prs', true),
('admin', 'view_gap_plans', true),
('admin', 'view_milestones', true),
('admin', 'view_simulations', true),
('admin', 'view_own_wages', true),
('admin', 'view_team_wages', true),
('admin', 'manage_wages', true),
('admin', 'view_snapshot', true),
('admin', 'export_data', true),
('admin', 'manage_permissions', true),
('admin', 'system_settings', true),

-- Manager permissions
('manager', 'view_dashboard', true),
('manager', 'view_aggregated_data', true),
('manager', 'view_own_activities', true),
('manager', 'view_team_activities', true),
('manager', 'manage_own_activities', true),
('manager', 'view_own_hospitals', true),
('manager', 'view_all_hospitals', true),
('manager', 'view_contacts', true),
('manager', 'manage_contacts', true),
('manager', 'view_users', true),
('manager', 'manage_users', true),
('manager', 'send_invitations', true),
('manager', 'view_prs', true),
('manager', 'view_gap_plans', true),
('manager', 'view_milestones', true),
('manager', 'view_simulations', true),
('manager', 'view_own_wages', true),
('manager', 'view_team_wages', true),
('manager', 'manage_wages', true),
('manager', 'view_snapshot', true),
('manager', 'export_data', true),

-- Mentor permissions
('mentor', 'view_dashboard', true),
('mentor', 'view_aggregated_data', true),
('mentor', 'view_own_activities', true),
('mentor', 'view_team_activities', true),
('mentor', 'manage_own_activities', true),
('mentor', 'view_own_hospitals', true),
('mentor', 'view_contacts', true),
('mentor', 'manage_contacts', true),
('mentor', 'send_invitations', true),
('mentor', 'view_prs', true),
('mentor', 'view_gap_plans', true),
('mentor', 'view_milestones', true),
('mentor', 'view_simulations', true),
('mentor', 'view_own_wages', true),
('mentor', 'view_snapshot', true),
('mentor', 'export_data', true),

-- PECC permissions
('pecc', 'view_dashboard', true),
('pecc', 'view_own_activities', true),
('pecc', 'manage_own_activities', true),
('pecc', 'view_own_hospitals', true),
('pecc', 'view_prs', true),
('pecc', 'view_gap_plans', true),
('pecc', 'view_milestones', true),
('pecc', 'view_simulations', true),
('pecc', 'view_snapshot', true);
