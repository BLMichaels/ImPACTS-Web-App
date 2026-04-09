-- RLS policies and helpers for hospital-owned PECC continuity data.
-- Run after HOSPITAL_DATA_TABLE.sql

BEGIN;

-- Canonical resolver: users.hospital_facility_id -> hospitals.id
CREATE OR REPLACE FUNCTION public.resolve_hospital_uuid_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT;
  v_hospital UUID;
BEGIN
  SELECT NULLIF(TRIM(u.hospital_facility_id), '')
    INTO v_ref
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_ref IS NULL THEN
    RETURN NULL;
  END IF;

  -- Try direct UUID id match first.
  SELECT h.id
    INTO v_hospital
  FROM public.hospitals h
  WHERE h.id::TEXT = v_ref
  LIMIT 1;

  IF v_hospital IS NOT NULL THEN
    RETURN v_hospital;
  END IF;

  -- Fallback to dynamic property access for facility_id (works even if column is absent).
  SELECT h.id
    INTO v_hospital
  FROM public.hospitals h
  WHERE COALESCE(to_jsonb(h)->>'facility_id', '') = v_ref
  LIMIT 1;

  RETURN v_hospital;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_hospital_uuid_for_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_hospital_uuid_for_user(UUID) TO authenticated;

-- Unified hospital access check for hospital_data RLS.
CREATE OR REPLACE FUNCTION public.can_access_hospital_data(p_hospital_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_is_admin BOOLEAN := false;
  v_site_id_from_hospital TEXT;
  v_allowed BOOLEAN := false;
BEGIN
  IF v_uid IS NULL OR p_hospital_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.role::TEXT, COALESCE(u.is_admin, false)
    INTO v_role, v_is_admin
  FROM public.users u
  WHERE u.id = v_uid;

  IF v_role IN ('admin', 'manager') OR v_is_admin THEN
    RETURN true;
  END IF;

  -- PECC (or any user) assigned directly via users.hospital_facility_id.
  IF public.resolve_hospital_uuid_for_user(v_uid) = p_hospital_id THEN
    RETURN true;
  END IF;

  -- Mentor assignment access.
  IF EXISTS (
    SELECT 1
    FROM public.mentor_hospital_assignments mha
    WHERE mha.hospital_id = p_hospital_id
      AND mha.mentor_id = v_uid
      AND COALESCE(mha.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  -- Shared site membership access (if site_members exists).
  IF to_regclass('public.site_members') IS NOT NULL THEN
    SELECT COALESCE(to_jsonb(h)->>'facility_id', h.id::TEXT)
      INTO v_site_id_from_hospital
    FROM public.hospitals h
    WHERE h.id = p_hospital_id
    LIMIT 1;

    IF v_site_id_from_hospital IS NOT NULL THEN
      EXECUTE $q$
        SELECT EXISTS (
          SELECT 1
          FROM public.site_members sm
          WHERE sm.site_id = $1
            AND sm.user_id = $2
        )
      $q$
      INTO v_allowed
      USING v_site_id_from_hospital, v_uid;

      IF v_allowed THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_hospital_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_hospital_data(UUID) TO authenticated;

DROP POLICY IF EXISTS "hospital_data_read" ON public.hospital_data;
CREATE POLICY "hospital_data_read"
  ON public.hospital_data
  FOR SELECT
  TO authenticated
  USING (public.can_access_hospital_data(hospital_id));

DROP POLICY IF EXISTS "hospital_data_insert" ON public.hospital_data;
CREATE POLICY "hospital_data_insert"
  ON public.hospital_data
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_hospital_data(hospital_id));

DROP POLICY IF EXISTS "hospital_data_update" ON public.hospital_data;
CREATE POLICY "hospital_data_update"
  ON public.hospital_data
  FOR UPDATE
  TO authenticated
  USING (public.can_access_hospital_data(hospital_id))
  WITH CHECK (public.can_access_hospital_data(hospital_id));

DROP POLICY IF EXISTS "hospital_data_delete" ON public.hospital_data;
CREATE POLICY "hospital_data_delete"
  ON public.hospital_data
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.is_admin, false))
    )
  );

-- Automatically stamp modifier user/time on writes.
CREATE OR REPLACE FUNCTION public.hospital_data_set_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hospital_data_set_audit_fields ON public.hospital_data;
CREATE TRIGGER trg_hospital_data_set_audit_fields
  BEFORE INSERT OR UPDATE ON public.hospital_data
  FOR EACH ROW
  EXECUTE FUNCTION public.hospital_data_set_audit_fields();

COMMIT;
