-- SimBox site_key → PECC hospital mapping + idempotent activity append RPC.
-- Applied to ImPACTS_Tracker (ftpifgzzfwpujlvbqqhu).
--
-- How admins register a site:
--   INSERT INTO public.simbox_site_hospitals (site_key, facility_id, notes)
--   VALUES ('EMORY_ED', '110010', 'Emory University Hospital ED')
--   ON CONFLICT (site_key) DO UPDATE
--     SET facility_id = EXCLUDED.facility_id,
--         active = true,
--         notes = EXCLUDED.notes,
--         updated_at = now();
--
-- site_key must match SimBox URL ?simbox_site=… / metadata.siteKey
--   pattern: ^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$
-- facility_id must exist in public.hospitals.facility_id

BEGIN;

CREATE TABLE IF NOT EXISTS public.simbox_site_hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key text NOT NULL,
  facility_id text NOT NULL REFERENCES public.hospitals(facility_id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simbox_site_hospitals_site_key_unique UNIQUE (site_key),
  CONSTRAINT simbox_site_hospitals_site_key_format
    CHECK (site_key ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$')
);

CREATE INDEX IF NOT EXISTS simbox_site_hospitals_facility_idx
  ON public.simbox_site_hospitals (facility_id);

CREATE INDEX IF NOT EXISTS simbox_site_hospitals_active_idx
  ON public.simbox_site_hospitals (active)
  WHERE active = true;

COMMENT ON TABLE public.simbox_site_hospitals IS
  'Maps SimBox Analytics site_key values to PECC Support Tool hospitals (by facility_id) for auto activity logging.';

ALTER TABLE public.simbox_site_hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simbox_site_hospitals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS simbox_site_hospitals_admin_all ON public.simbox_site_hospitals;
CREATE POLICY simbox_site_hospitals_admin_all
  ON public.simbox_site_hospitals
  FOR ALL
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- Authenticated users can read active mappings (for future admin UI / debugging).
DROP POLICY IF EXISTS simbox_site_hospitals_select_active ON public.simbox_site_hospitals;
CREATE POLICY simbox_site_hospitals_select_active
  ON public.simbox_site_hospitals
  FOR SELECT
  TO authenticated
  USING (active = true AND public.current_user_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simbox_site_hospitals TO authenticated;
GRANT ALL ON public.simbox_site_hospitals TO service_role;

-- Idempotent append into hospital_data.activities (row-locked).
-- p_activity must include simbox_session_id for dedupe.
CREATE OR REPLACE FUNCTION public.append_simbox_hospital_activity(
  p_facility_id text,
  p_activity jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hospital_id uuid;
  v_session_id text;
  v_activities jsonb;
  v_existing jsonb;
  v_item jsonb;
BEGIN
  IF p_facility_id IS NULL OR btrim(p_facility_id) = '' THEN
    RAISE EXCEPTION 'facility_id is required';
  END IF;
  IF p_activity IS NULL OR jsonb_typeof(p_activity) <> 'object' THEN
    RAISE EXCEPTION 'activity object is required';
  END IF;

  v_session_id := nullif(btrim(coalesce(p_activity->>'simbox_session_id', '')), '');
  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'simbox_session_id is required on activity';
  END IF;

  SELECT h.id
    INTO v_hospital_id
  FROM public.hospitals h
  WHERE h.facility_id = btrim(p_facility_id)
  LIMIT 1;

  IF v_hospital_id IS NULL THEN
    RAISE EXCEPTION 'hospital not found for facility_id %', p_facility_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT hd.value
    INTO v_activities
  FROM public.hospital_data hd
  WHERE hd.hospital_id = v_hospital_id
    AND hd.data_key = 'activities'
  FOR UPDATE;

  IF v_activities IS NULL THEN
    INSERT INTO public.hospital_data (hospital_id, data_key, value, updated_at, updated_by)
    VALUES (v_hospital_id, 'activities', '[]'::jsonb, now(), NULL)
    ON CONFLICT (hospital_id, data_key) DO NOTHING;

    SELECT hd.value
      INTO v_activities
    FROM public.hospital_data hd
    WHERE hd.hospital_id = v_hospital_id
      AND hd.data_key = 'activities'
    FOR UPDATE;
  END IF;

  IF v_activities IS NULL OR jsonb_typeof(v_activities) <> 'array' THEN
    v_activities := '[]'::jsonb;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_activities)
  LOOP
    IF coalesce(v_item->>'simbox_session_id', '') = v_session_id
       OR position(v_session_id IN coalesce(v_item->>'notes', '')) > 0 THEN
      RETURN jsonb_build_object(
        'status', 'duplicate',
        'hospital_id', v_hospital_id,
        'facility_id', btrim(p_facility_id),
        'activity', v_item
      );
    END IF;
  END LOOP;

  v_activities := v_activities || jsonb_build_array(p_activity);

  INSERT INTO public.hospital_data (hospital_id, data_key, value, updated_at, updated_by)
  VALUES (v_hospital_id, 'activities', v_activities, now(), NULL)
  ON CONFLICT (hospital_id, data_key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at,
        updated_by = NULL;

  RETURN jsonb_build_object(
    'status', 'created',
    'hospital_id', v_hospital_id,
    'facility_id', btrim(p_facility_id),
    'activity', p_activity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.append_simbox_hospital_activity(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_simbox_hospital_activity(text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.append_simbox_hospital_activity(text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.append_simbox_hospital_activity(text, jsonb) TO service_role;

COMMENT ON FUNCTION public.append_simbox_hospital_activity(text, jsonb) IS
  'Service-role only. Appends a SimBox-sourced activity to hospital_data.activities with session_id idempotency.';

-- Example seed (safe upsert). Adjust facility_id to the correct hospital before relying on it.
INSERT INTO public.simbox_site_hospitals (site_key, facility_id, active, notes)
VALUES
  ('EMORY_ED', '110010', true, 'Example: Emory University Hospital — update if SimBox site maps elsewhere'),
  ('SIMBOX_TEST', '110010', true, 'Curl / acceptance-test site_key; deactivate when unused')
ON CONFLICT (site_key) DO UPDATE
  SET facility_id = EXCLUDED.facility_id,
      active = EXCLUDED.active,
      notes = EXCLUDED.notes,
      updated_at = now();

COMMIT;
