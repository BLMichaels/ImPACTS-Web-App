-- Backfill users.hospital_facility_id for PECCs from CRM linked_hospital_ids (first hospital wins).
-- Then sync mentor_hospital_assignments for mentor + PECC hospital pairs.
-- Idempotent.

BEGIN;

WITH pecc_crm AS (
  SELECT
    u.id AS pecc_user_id,
    u.mentor_id,
    co.id AS crm_org_id,
    (co.linked_hospital_ids)[1]::text AS first_hospital_id
  FROM public.users u
  JOIN public.crm_organizations co
    ON co.contact_type = 'pecc'
   AND (
     co.user_id = u.id
     OR LOWER(TRIM(co.email)) = LOWER(TRIM(u.email))
   )
  WHERE u.role = 'pecc'
    AND (u.hospital_facility_id IS NULL OR TRIM(u.hospital_facility_id) = '')
    AND co.linked_hospital_ids IS NOT NULL
    AND cardinality(co.linked_hospital_ids) > 0
),
resolved AS (
  SELECT
    pc.pecc_user_id,
    pc.mentor_id,
    COALESCE(NULLIF(TRIM(h.facility_id::text), ''), h.id::text) AS facility_ref
  FROM pecc_crm pc
  JOIN public.hospitals h ON h.id::text = pc.first_hospital_id
)
UPDATE public.users u
SET
  hospital_facility_id = r.facility_ref,
  updated_at = NOW()
FROM resolved r
WHERE u.id = r.pecc_user_id
  AND (u.hospital_facility_id IS NULL OR TRIM(u.hospital_facility_id) = '');

UPDATE public.crm_organizations co
SET user_id = pc.pecc_user_id
FROM pecc_crm pc
WHERE co.id = pc.crm_org_id
  AND (co.user_id IS NULL OR co.user_id <> pc.pecc_user_id);

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
