-- Backfill PECC operational data from public.user_data -> public.hospital_data.
-- Run after:
--   1) HOSPITAL_DATA_TABLE.sql
--   2) HOSPITAL_DATA_RLS_POLICIES.sql
--
-- Notes:
-- - Idempotent by design (upserts + migration log).
-- - Keeps user attribution in migrated JSON payload under `_migrated_from_user_id` when needed.
-- - Uses users.hospital_facility_id mapped to hospitals.id / hospitals.facility_id.
-- - Deduplicates by (hospital_id, data_key) and keeps latest updated_at when multiple
--   users map to the same hospital key.

BEGIN;

CREATE TABLE IF NOT EXISTS public.hospital_data_migration_log (
  id BIGSERIAL PRIMARY KEY,
  source_user_id UUID NOT NULL,
  source_data_key TEXT NOT NULL,
  target_hospital_id UUID,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_user_id, source_data_key, target_hospital_id)
);

CREATE INDEX IF NOT EXISTS idx_hospital_data_migration_log_status
  ON public.hospital_data_migration_log(status, migrated_at DESC);

WITH scoped_source AS (
  SELECT
    ud.user_id,
    ud.data_key,
    ud.value,
    ud.updated_at,
    NULLIF(TRIM(u.hospital_facility_id), '') AS hospital_ref
  FROM public.user_data ud
  JOIN public.users u ON u.id = ud.user_id
  WHERE ud.data_key IN (
    'activities',
    'gapPlans',
    'milestones',
    'simulation_sessions',
    'simulation_gaps',
    'readinessScores',
    'prsQuestions',
    'prsReadinessScores'
  )
),
resolved AS (
  SELECT
    s.user_id,
    s.data_key,
    s.value,
    s.updated_at,
    h.id AS hospital_id
  FROM scoped_source s
  LEFT JOIN LATERAL (
    SELECT h2.id
    FROM public.hospitals h2
    WHERE h2.id::TEXT = s.hospital_ref
       OR COALESCE(to_jsonb(h2)->>'facility_id', '') = COALESCE(s.hospital_ref, '')
    ORDER BY CASE WHEN h2.id::TEXT = s.hospital_ref THEN 0 ELSE 1 END
    LIMIT 1
  ) h ON true
),
eligible AS (
  SELECT *
  FROM resolved
  WHERE hospital_id IS NOT NULL
),
eligible_dedup AS (
  SELECT *
  FROM (
    SELECT
      e.*,
      ROW_NUMBER() OVER (
        PARTITION BY e.hospital_id, e.data_key
        ORDER BY e.updated_at DESC NULLS LAST, e.user_id
      ) AS rn
    FROM eligible e
  ) ranked
  WHERE rn = 1
),
upserted AS (
  INSERT INTO public.hospital_data AS hd (hospital_id, data_key, value, updated_at)
  SELECT
    e.hospital_id,
    e.data_key,
    e.value,
    e.updated_at
  FROM eligible_dedup e
  ON CONFLICT (hospital_id, data_key)
  DO UPDATE SET
    -- Keep the most recently updated source value.
    value = CASE
      WHEN EXCLUDED.updated_at >= hd.updated_at THEN EXCLUDED.value
      ELSE hd.value
    END,
    updated_at = GREATEST(hd.updated_at, EXCLUDED.updated_at)
  RETURNING hospital_id, data_key
)
INSERT INTO public.hospital_data_migration_log (
  source_user_id,
  source_data_key,
  target_hospital_id,
  status,
  details
)
SELECT
  e.user_id,
  e.data_key,
  e.hospital_id,
  'migrated',
  jsonb_build_object('note', 'Backfilled into hospital_data via idempotent upsert')
FROM eligible e
ON CONFLICT (source_user_id, source_data_key, target_hospital_id)
DO UPDATE SET
  migrated_at = NOW(),
  status = EXCLUDED.status,
  details = EXCLUDED.details;

-- Log unresolved rows (no hospital mapping), without failing the migration.
WITH scoped_source AS (
  SELECT
    ud.user_id,
    ud.data_key,
    NULLIF(TRIM(u.hospital_facility_id), '') AS hospital_ref
  FROM public.user_data ud
  JOIN public.users u ON u.id = ud.user_id
  WHERE ud.data_key IN (
    'activities',
    'gapPlans',
    'milestones',
    'simulation_sessions',
    'simulation_gaps',
    'readinessScores',
    'prsQuestions',
    'prsReadinessScores'
  )
),
resolved AS (
  SELECT
    s.user_id,
    s.data_key,
    h.id AS hospital_id
  FROM scoped_source s
  LEFT JOIN LATERAL (
    SELECT h2.id
    FROM public.hospitals h2
    WHERE h2.id::TEXT = s.hospital_ref
       OR COALESCE(to_jsonb(h2)->>'facility_id', '') = COALESCE(s.hospital_ref, '')
    ORDER BY CASE WHEN h2.id::TEXT = s.hospital_ref THEN 0 ELSE 1 END
    LIMIT 1
  ) h ON true
)
INSERT INTO public.hospital_data_migration_log (
  source_user_id,
  source_data_key,
  target_hospital_id,
  status,
  details
)
SELECT
  r.user_id,
  r.data_key,
  NULL,
  'unresolved_hospital_mapping',
  jsonb_build_object('note', 'No hospitals.id/facility_id match for users.hospital_facility_id')
FROM resolved r
WHERE r.hospital_id IS NULL;

COMMIT;
