-- Department contacts are hospital-shared (same hospital only) and must never
-- live in user_data (that fallback leaked Duke's directory onto other accounts).
--
-- 1) Allow hospital_data writes for dashboard_department_contacts again
-- 2) Restore each hospital's directory from the assigned PECC's remaining copy
-- 3) Delete leftover user_data copies so they cannot leak via fallback

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_hospital_data_private_keys()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_key IN (
    'dashboard_resources'
  ) THEN
    RAISE EXCEPTION
      USING MESSAGE = format(
        'data_key "%" is user-private and cannot be stored in hospital_data',
        NEW.data_key
      ),
      ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_hospital_data_private_keys() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_hospital_data_private_keys() TO authenticated;

DROP TRIGGER IF EXISTS trg_guard_hospital_data_private_keys ON public.hospital_data;
CREATE TRIGGER trg_guard_hospital_data_private_keys
  BEFORE INSERT OR UPDATE ON public.hospital_data
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_hospital_data_private_keys();

-- Restore hospital-scoped directories from remaining user copies that belong
-- to a PECC with a resolvable hospital assignment.
INSERT INTO public.hospital_data AS hd (hospital_id, data_key, value, updated_at, updated_by)
SELECT
  h.id,
  'dashboard_department_contacts',
  ud.value,
  ud.updated_at,
  ud.user_id
FROM public.user_data ud
JOIN public.users u ON u.id = ud.user_id
JOIN public.hospitals h
  ON h.id::text = NULLIF(TRIM(u.hospital_facility_id), '')
  OR COALESCE(h.facility_id, '') = NULLIF(TRIM(u.hospital_facility_id), '')
WHERE ud.data_key = 'dashboard_department_contacts'
  AND u.hospital_facility_id IS NOT NULL
  AND NULLIF(TRIM(u.hospital_facility_id), '') IS NOT NULL
ON CONFLICT (hospital_id, data_key)
DO UPDATE SET
  value = CASE
    WHEN EXCLUDED.updated_at >= hd.updated_at THEN EXCLUDED.value
    ELSE hd.value
  END,
  updated_at = GREATEST(hd.updated_at, EXCLUDED.updated_at),
  updated_by = CASE
    WHEN EXCLUDED.updated_at >= hd.updated_at THEN EXCLUDED.updated_by
    ELSE hd.updated_by
  END;

-- Remove personal copies so missing hospital rows cannot fall back to another site's list.
DELETE FROM public.user_data
WHERE data_key = 'dashboard_department_contacts';

COMMIT;
