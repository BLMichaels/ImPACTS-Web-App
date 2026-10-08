-- Backfill mentor_hospital_assignments from CRM mentor linked_hospital_ids.
-- Run in Supabase SQL Editor if assignments lag behind CRM (e.g. Ashley Flannery).
-- Safe to re-run: skips existing (mentor_id, hospital_id) pairs and reactivates inactive rows.

INSERT INTO public.mentor_hospital_assignments (mentor_id, hospital_id, assigned_by, is_active)
SELECT DISTINCT
  COALESCE(c.user_id, u.id) AS mentor_id,
  h.id AS hospital_id,
  COALESCE(c.user_id, u.id) AS assigned_by,
  true AS is_active
FROM public.crm_organizations c
JOIN LATERAL unnest(COALESCE(c.linked_hospital_ids, ARRAY[]::uuid[])) AS linked_id(hid) ON true
JOIN public.hospitals h ON h.id = linked_id.hid
LEFT JOIN public.users u
  ON u.role = 'mentor'
 AND c.email IS NOT NULL
 AND lower(u.email) = lower(c.email)
WHERE c.contact_type = 'mentor'
  AND COALESCE(c.user_id, u.id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.mentor_hospital_assignments mha
    WHERE mha.mentor_id = COALESCE(c.user_id, u.id)
      AND mha.hospital_id = h.id
  );

UPDATE public.mentor_hospital_assignments mha
SET is_active = true
FROM public.crm_organizations c
JOIN LATERAL unnest(COALESCE(c.linked_hospital_ids, ARRAY[]::uuid[])) AS linked_id(hid) ON true
WHERE c.contact_type = 'mentor'
  AND mha.hospital_id = linked_id.hid
  AND (
    mha.mentor_id = c.user_id
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = mha.mentor_id
        AND u.role = 'mentor'
        AND c.email IS NOT NULL
        AND lower(u.email) = lower(c.email)
    )
  )
  AND mha.is_active IS DISTINCT FROM true;
