-- Backfill users.hospital_facility_id for PECCs linked to a mentor but missing a site ref.
-- Matches mentor CRM contacts (user_data.mentorContacts) by email (incl. small domain typos), name,
-- or single-PECC / single–working-with-mentor contact fallback.
-- Idempotent: only updates rows where hospital_facility_id is null/blank.

BEGIN;

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

CREATE TABLE IF NOT EXISTS public.pecc_hospital_facility_backfill_log (
  id BIGSERIAL PRIMARY KEY,
  pecc_user_id UUID NOT NULL,
  mentor_id UUID NOT NULL,
  contact_hospital_ref TEXT,
  resolved_hospital_facility_id TEXT NOT NULL,
  match_reason TEXT NOT NULL,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pecc_user_id)
);

WITH peccs_needing AS (
  SELECT
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.mentor_id
  FROM public.users u
  WHERE u.role = 'pecc'
    AND u.mentor_id IS NOT NULL
    AND (u.hospital_facility_id IS NULL OR TRIM(u.hospital_facility_id) = '')
),
mentor_contact_rows AS (
  SELECT
    ud.user_id AS mentor_id,
    c AS contact
  FROM public.user_data ud
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(ud.value) = 'array' THEN ud.value
      ELSE '[]'::jsonb
    END
  ) AS c
  WHERE ud.data_key = 'mentorContacts'
),
contacts_parsed AS (
  SELECT
    mentor_id,
    NULLIF(TRIM(contact->>'hospitalId'), '') AS contact_hospital_ref,
    NULLIF(TRIM(LOWER(contact->>'email')), '') AS contact_email,
    NULLIF(TRIM(LOWER(CONCAT(contact->>'firstName', ' ', contact->>'lastName'))), '') AS contact_name,
    COALESCE((contact->>'isWorkingWithMentor')::boolean, false) AS is_working_with_mentor,
    COALESCE((contact->>'isPrimaryContact')::boolean, false) AS is_primary_contact
  FROM mentor_contact_rows
  WHERE NULLIF(TRIM(contact->>'hospitalId'), '') IS NOT NULL
),
pecc_contact_pairs AS (
  SELECT
    p.id AS pecc_id,
    p.mentor_id,
    cp.contact_hospital_ref,
    CASE
      WHEN NULLIF(TRIM(LOWER(p.email)), '') IS NOT NULL
        AND cp.contact_email IS NOT NULL
        AND LOWER(TRIM(p.email)) = cp.contact_email THEN 'email_exact'
      WHEN NULLIF(TRIM(LOWER(p.email)), '') IS NOT NULL
        AND cp.contact_email IS NOT NULL
        AND SPLIT_PART(LOWER(TRIM(p.email)), '@', 1) = SPLIT_PART(cp.contact_email, '@', 1)
        AND levenshtein(
          SPLIT_PART(LOWER(TRIM(p.email)), '@', 2),
          SPLIT_PART(cp.contact_email, '@', 2)
        ) <= 2 THEN 'email_fuzzy'
      WHEN NULLIF(TRIM(LOWER(CONCAT(p.first_name, ' ', p.last_name))), '') IS NOT NULL
        AND cp.contact_name IS NOT NULL
        AND LOWER(TRIM(CONCAT(p.first_name, ' ', p.last_name))) = cp.contact_name THEN 'name_exact'
      ELSE NULL
    END AS match_reason
  FROM peccs_needing p
  JOIN contacts_parsed cp ON cp.mentor_id = p.mentor_id
),
pair_matches AS (
  SELECT DISTINCT ON (pecc_id)
    pecc_id,
    mentor_id,
    contact_hospital_ref,
    match_reason
  FROM pecc_contact_pairs
  WHERE match_reason IS NOT NULL
  ORDER BY pecc_id,
    CASE match_reason
      WHEN 'email_exact' THEN 1
      WHEN 'name_exact' THEN 2
      WHEN 'email_fuzzy' THEN 3
      ELSE 4
    END
),
mentor_pecc_counts AS (
  SELECT mentor_id, COUNT(*)::int AS pecc_count
  FROM peccs_needing
  GROUP BY mentor_id
),
mentor_working_contacts AS (
  SELECT
    cp.mentor_id,
    cp.contact_hospital_ref,
    COUNT(*)::int AS working_contact_count
  FROM contacts_parsed cp
  WHERE cp.is_working_with_mentor OR cp.is_primary_contact
  GROUP BY cp.mentor_id, cp.contact_hospital_ref
),
fallback_matches AS (
  SELECT
    p.id AS pecc_id,
    p.mentor_id,
    mwc.contact_hospital_ref,
    'single_pecc_working_contact' AS match_reason
  FROM peccs_needing p
  JOIN mentor_pecc_counts mpc ON mpc.mentor_id = p.mentor_id AND mpc.pecc_count = 1
  JOIN mentor_working_contacts mwc ON mwc.mentor_id = p.mentor_id AND mwc.working_contact_count = 1
  WHERE NOT EXISTS (SELECT 1 FROM pair_matches pm WHERE pm.pecc_id = p.id)
),
all_matches AS (
  SELECT * FROM pair_matches
  UNION ALL
  SELECT * FROM fallback_matches
),
resolved AS (
  SELECT
    am.pecc_id,
    am.mentor_id,
    am.contact_hospital_ref,
    am.match_reason,
    COALESCE(
      NULLIF(TRIM(h.facility_id::text), ''),
      h.id::text
    ) AS resolved_hospital_facility_id
  FROM all_matches am
  JOIN LATERAL (
    SELECT h2.id, h2.facility_id
    FROM public.hospitals h2
    WHERE h2.id::text = am.contact_hospital_ref
       OR COALESCE(h2.facility_id::text, '') = am.contact_hospital_ref
    ORDER BY CASE WHEN h2.id::text = am.contact_hospital_ref THEN 0 ELSE 1 END
    LIMIT 1
  ) h ON true
  WHERE am.contact_hospital_ref IS NOT NULL
),
updated AS (
  UPDATE public.users u
  SET
    hospital_facility_id = r.resolved_hospital_facility_id,
    updated_at = NOW()
  FROM resolved r
  WHERE u.id = r.pecc_id
    AND (u.hospital_facility_id IS NULL OR TRIM(u.hospital_facility_id) = '')
  RETURNING u.id AS pecc_user_id, r.mentor_id, r.contact_hospital_ref, r.resolved_hospital_facility_id, r.match_reason
)
INSERT INTO public.pecc_hospital_facility_backfill_log (
  pecc_user_id,
  mentor_id,
  contact_hospital_ref,
  resolved_hospital_facility_id,
  match_reason
)
SELECT
  pecc_user_id,
  mentor_id,
  contact_hospital_ref,
  resolved_hospital_facility_id,
  match_reason
FROM updated
ON CONFLICT (pecc_user_id) DO UPDATE SET
  mentor_id = EXCLUDED.mentor_id,
  contact_hospital_ref = EXCLUDED.contact_hospital_ref,
  resolved_hospital_facility_id = EXCLUDED.resolved_hospital_facility_id,
  match_reason = EXCLUDED.match_reason,
  migrated_at = NOW();

COMMIT;
