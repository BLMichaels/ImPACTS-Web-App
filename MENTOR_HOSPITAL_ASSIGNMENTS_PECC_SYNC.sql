-- Backfill mentor_hospital_assignments from PECC hospital + mentor links.
-- Idempotent: skips existing (mentor_id, hospital_id) pairs; reactivates inactive rows.

BEGIN;

INSERT INTO public.mentor_hospital_assignments (mentor_id, hospital_id, assigned_by, is_active)
SELECT DISTINCT
  p.mentor_id,
  h.id AS hospital_id,
  p.mentor_id AS assigned_by,
  true AS is_active
FROM public.users p
JOIN public.hospitals h
  ON h.id::text = TRIM(p.hospital_facility_id)
  OR (h.facility_id IS NOT NULL AND h.facility_id::text = TRIM(p.hospital_facility_id))
WHERE p.role = 'pecc'
  AND p.mentor_id IS NOT NULL
  AND TRIM(COALESCE(p.hospital_facility_id, '')) <> ''
ON CONFLICT (mentor_id, hospital_id) DO UPDATE
SET is_active = true;

COMMIT;
