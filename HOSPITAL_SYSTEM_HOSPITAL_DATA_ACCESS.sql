-- Allow hospital_system and hiring_group users to read hospital_data for sites
-- in their assigned systems (hospital_system text match + CRM system linked_hospital_ids).
-- Applied remotely as migration hospital_system_hiring_group_hospital_data_access.

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

  IF public.resolve_hospital_uuid_for_user(v_uid) = p_hospital_id THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mentor_hospital_assignments mha
    WHERE mha.hospital_id = p_hospital_id
      AND mha.mentor_id = v_uid
      AND COALESCE(mha.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hospital_system_assignments hsa
    JOIN public.hospitals h ON h.id = p_hospital_id
    WHERE hsa.user_id = v_uid
      AND NULLIF(BTRIM(h.hospital_system), '') IS NOT NULL
      AND LOWER(BTRIM(h.hospital_system)) = LOWER(BTRIM(hsa.hospital_system_name))
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hospital_system_assignments hsa
    JOIN public.crm_organizations crm
      ON crm.contact_type = 'system'
     AND LOWER(BTRIM(crm.name)) = LOWER(BTRIM(hsa.hospital_system_name))
    WHERE hsa.user_id = v_uid
      AND crm.linked_hospital_ids IS NOT NULL
      AND p_hospital_id = ANY (crm.linked_hospital_ids)
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hiring_group_assignments hga
    JOIN public.hospitals h ON h.id = p_hospital_id
    WHERE hga.user_id = v_uid
      AND NULLIF(BTRIM(h.hospital_system), '') IS NOT NULL
      AND LOWER(BTRIM(h.hospital_system)) = LOWER(BTRIM(hga.hospital_system_name))
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hiring_group_assignments hga
    JOIN public.crm_organizations crm
      ON crm.contact_type = 'system'
     AND LOWER(BTRIM(crm.name)) = LOWER(BTRIM(hga.hospital_system_name))
    WHERE hga.user_id = v_uid
      AND crm.linked_hospital_ids IS NOT NULL
      AND p_hospital_id = ANY (crm.linked_hospital_ids)
  ) THEN
    RETURN true;
  END IF;

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
