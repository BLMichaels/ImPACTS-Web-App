-- Harden invitation and CRM access policies.
-- Run in Supabase SQL editor (idempotent-safe where possible).

BEGIN;

-- Invitations: remove overly-broad public read/update policies.
DROP POLICY IF EXISTS "Public read for acceptance" ON public.invitations;
DROP POLICY IF EXISTS "Update invitations for acceptance" ON public.invitations;

-- Invitations: authenticated users can only read invitations they created.
DROP POLICY IF EXISTS "View own invitations" ON public.invitations;
CREATE POLICY "View own invitations" ON public.invitations
  FOR SELECT
  TO authenticated
  USING (invited_by = auth.uid());

-- Invitations: admin/manager may read all invitations for operations visibility.
DROP POLICY IF EXISTS "Admins/Managers view invitations" ON public.invitations;
CREATE POLICY "Admins/Managers view invitations" ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR u.is_admin = true)
    )
  );

-- Invitations: only privileged users can create.
DROP POLICY IF EXISTS "Create invitations" ON public.invitations;
CREATE POLICY "Create invitations" ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager', 'mentor') OR u.is_admin = true)
    )
  );

-- Invitations: only privileged users may update/cancel invitation rows directly.
-- Acceptance should happen via secure server function.
CREATE POLICY IF NOT EXISTS "Privileged update invitations" ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR u.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR u.is_admin = true)
    )
  );

-- CRM: remove "any authenticated user full access" policy and restrict writes.
DROP POLICY IF EXISTS "Allow authenticated users full access to CRM" ON public.crm_organizations;

CREATE POLICY IF NOT EXISTS "CRM read for authenticated users" ON public.crm_organizations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "CRM write for admins/managers" ON public.crm_organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR u.is_admin = true)
    )
  );

CREATE POLICY IF NOT EXISTS "CRM update for admins/managers" ON public.crm_organizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR u.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR u.is_admin = true)
    )
  );

CREATE POLICY IF NOT EXISTS "CRM delete for admins/managers" ON public.crm_organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR u.is_admin = true)
    )
  );

COMMIT;
