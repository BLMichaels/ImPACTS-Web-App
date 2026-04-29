-- Align PECC activities reads toward hospital-owned continuity.
-- Transitional script: keeps legacy public.pecc_activities usable while introducing a
-- canonical hospital-scoped read model sourced from public.hospital_data('activities').

BEGIN;

-- Flatten hospital_data.activities JSON arrays for reporting and audits.
CREATE OR REPLACE VIEW public.hospital_activities_read_model AS
SELECT
  hd.hospital_id,
  hd.updated_at AS continuity_updated_at,
  activity.value AS activity_json,
  COALESCE(activity.value->>'id', md5(activity.value::TEXT)) AS activity_id,
  COALESCE(activity.value->>'date', activity.value->>'createdAt') AS activity_date,
  activity.value->>'activityType' AS activity_type,
  activity.value->>'activityCategory' AS activity_category,
  activity.value->>'activityDescription' AS activity_description,
  activity.value->>'submittedBy' AS submitted_by_name,
  activity.value->>'created_by' AS created_by_user_id,
  activity.value->>'submitted_by' AS submitted_by_user_id
FROM public.hospital_data hd
LEFT JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(hd.value) = 'array' THEN hd.value
    ELSE '[]'::jsonb
  END
) AS activity(value) ON true
WHERE hd.data_key = 'activities';

COMMENT ON VIEW public.hospital_activities_read_model IS
  'Canonical flattened activities read model from hospital_data.activities (hospital-owned continuity).';

-- Convenience RPC for frontend/report consumers.
CREATE OR REPLACE FUNCTION public.get_hospital_activities(p_hospital_ref TEXT)
RETURNS TABLE (
  hospital_id UUID,
  activity_id TEXT,
  activity_date TEXT,
  activity_type TEXT,
  activity_category TEXT,
  activity_description TEXT,
  submitted_by_name TEXT,
  created_by_user_id TEXT,
  submitted_by_user_id TEXT,
  activity_json JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital_id UUID;
BEGIN
  SELECT h.id
    INTO v_hospital_id
  FROM public.hospitals h
  WHERE h.id::TEXT = NULLIF(TRIM(p_hospital_ref), '')
     OR COALESCE(to_jsonb(h)->>'facility_id', '') = NULLIF(TRIM(p_hospital_ref), '')
  ORDER BY CASE WHEN h.id::TEXT = NULLIF(TRIM(p_hospital_ref), '') THEN 0 ELSE 1 END
  LIMIT 1;
  IF v_hospital_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_access_hospital_data(v_hospital_id) THEN
    RAISE EXCEPTION 'Not authorized for hospital %', v_hospital_id;
  END IF;

  RETURN QUERY
  SELECT
    h.hospital_id,
    h.activity_id,
    h.activity_date,
    h.activity_type,
    h.activity_category,
    h.activity_description,
    h.submitted_by_name,
    h.created_by_user_id,
    h.submitted_by_user_id,
    h.activity_json
  FROM public.hospital_activities_read_model h
  WHERE h.hospital_id = v_hospital_id
  ORDER BY h.activity_date DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_hospital_activities(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hospital_activities(TEXT) TO authenticated;

COMMIT;
