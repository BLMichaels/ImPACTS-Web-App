-- Explicit PECC replacement workflow (admin/manager action)
-- Adds RPC-style functions to:
-- 1) identify active PECC users for a hospital
-- 2) optionally deactivate previous PECC user accounts
-- 3) keep hospital continuity data untouched (hospital_data is never deleted)
--
-- Run after:
--  - HOSPITAL_DATA_TABLE.sql
--  - HOSPITAL_DATA_RLS_POLICIES.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_hospital_uuid_from_ref(p_hospital_ref TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT := NULLIF(TRIM(p_hospital_ref), '');
  v_hospital UUID;
BEGIN
  IF v_ref IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT h.id
    INTO v_hospital
  FROM public.hospitals h
  WHERE h.id::TEXT = v_ref
  LIMIT 1;

  IF v_hospital IS NOT NULL THEN
    RETURN v_hospital;
  END IF;

  SELECT h.id
    INTO v_hospital
  FROM public.hospitals h
  WHERE COALESCE(to_jsonb(h)->>'facility_id', '') = v_ref
  LIMIT 1;

  RETURN v_hospital;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_hospital_uuid_from_ref(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_hospital_uuid_from_ref(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_hospital_pecc_replacement(p_hospital_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_hospital_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform admins always allowed.
  IF EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_uid
      AND (u.role = 'admin' OR COALESCE(u.is_admin, false))
  ) THEN
    RETURN true;
  END IF;

  -- Managers allowed if they manage the hospital via mentor assignment chain.
  IF EXISTS (
    SELECT 1
    FROM public.users mgr
    WHERE mgr.id = v_uid
      AND mgr.role = 'manager'
      AND EXISTS (
        SELECT 1
        FROM public.users m
        JOIN public.mentor_hospital_assignments mha
          ON mha.mentor_id = m.id
         AND COALESCE(mha.is_active, true) = true
        WHERE m.role = 'mentor'
          AND m.manager_id = mgr.id
          AND mha.hospital_id = p_hospital_id
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_hospital_pecc_replacement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_hospital_pecc_replacement(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_active_peccs_for_hospital(p_hospital_ref TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  is_active BOOLEAN,
  hospital_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital_id UUID;
BEGIN
  v_hospital_id := public.resolve_hospital_uuid_from_ref(p_hospital_ref);
  IF v_hospital_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_manage_hospital_pecc_replacement(v_hospital_id) THEN
    RAISE EXCEPTION 'Not authorized to view PECC replacements for hospital %', v_hospital_id;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.is_active,
    v_hospital_id
  FROM public.users u
  WHERE u.role = 'pecc'
    AND COALESCE(u.is_active, true) = true
    AND public.resolve_hospital_uuid_for_user(u.id) = v_hospital_id
  ORDER BY u.updated_at DESC NULLS LAST, u.created_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_peccs_for_hospital(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_peccs_for_hospital(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_pecc_for_hospital(
  p_hospital_ref TEXT,
  p_new_pecc_user_id UUID DEFAULT NULL,
  p_old_pecc_user_ids UUID[] DEFAULT NULL,
  p_deactivate_previous BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital_id UUID;
  v_actor UUID := auth.uid();
  v_old_ids UUID[];
  v_updated_count INTEGER := 0;
BEGIN
  v_hospital_id := public.resolve_hospital_uuid_from_ref(p_hospital_ref);
  IF v_hospital_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'hospital_not_found'
    );
  END IF;

  IF NOT public.can_manage_hospital_pecc_replacement(v_hospital_id) THEN
    RAISE EXCEPTION 'Not authorized to replace PECC at hospital %', v_hospital_id;
  END IF;

  IF p_new_pecc_user_id IS NOT NULL THEN
    UPDATE public.users
    SET
      hospital_facility_id = v_hospital_id::TEXT,
      role = 'pecc',
      is_active = true,
      updated_at = NOW()
    WHERE id = p_new_pecc_user_id;
  END IF;

  IF p_deactivate_previous THEN
    IF p_old_pecc_user_ids IS NULL OR array_length(p_old_pecc_user_ids, 1) IS NULL THEN
      SELECT ARRAY_AGG(u.id)
        INTO v_old_ids
      FROM public.users u
      WHERE u.role = 'pecc'
        AND u.id <> COALESCE(p_new_pecc_user_id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND COALESCE(u.is_active, true) = true
        AND public.resolve_hospital_uuid_for_user(u.id) = v_hospital_id;
    ELSE
      v_old_ids := p_old_pecc_user_ids;
    END IF;

    IF v_old_ids IS NOT NULL AND array_length(v_old_ids, 1) > 0 THEN
      UPDATE public.users
      SET
        is_active = false,
        updated_at = NOW()
      WHERE id = ANY(v_old_ids);
      GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;
  END IF;

  -- Intentionally do not mutate/delete hospital_data keys here.
  RETURN jsonb_build_object(
    'ok', true,
    'hospital_id', v_hospital_id,
    'new_pecc_user_id', p_new_pecc_user_id,
    'deactivated_count', v_updated_count,
    'actor_user_id', v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_pecc_for_hospital(TEXT, UUID, UUID[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_pecc_for_hospital(TEXT, UUID, UUID[], BOOLEAN) TO authenticated;

COMMIT;
