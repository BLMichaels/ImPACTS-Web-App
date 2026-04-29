-- Guardrails after cutover to hospital-owned continuity.
-- Blocks new writes to deprecated PECC operational keys in public.user_data when
-- app_settings.disable_legacy_user_data_pecc_keys = true.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_legacy_user_data_pecc_write_blocked()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag BOOLEAN := false;
BEGIN
  SELECT COALESCE((a.value::TEXT)::BOOLEAN, false)
    INTO v_flag
  FROM public.app_settings a
  WHERE a.key = 'disable_legacy_user_data_pecc_keys'
  LIMIT 1;

  RETURN COALESCE(v_flag, false);
EXCEPTION WHEN OTHERS THEN
  -- Fail open if app_settings is unavailable.
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_legacy_user_data_pecc_write_blocked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_legacy_user_data_pecc_write_blocked() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_legacy_user_data_pecc_keys()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block BOOLEAN := false;
BEGIN
  v_block := public.is_legacy_user_data_pecc_write_blocked();
  IF NOT v_block THEN
    RETURN NEW;
  END IF;

  IF NEW.data_key IN (
    'activities',
    'gapPlans',
    'milestones',
    'simulation_sessions',
    'simulation_gaps',
    'readinessScores',
    'prsQuestions',
    'prsReadinessScores'
  ) THEN
    RAISE EXCEPTION
      USING MESSAGE = format(
        'Write to legacy user_data key "%" is disabled after hospital_data cutover',
        NEW.data_key
      ),
      ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_legacy_user_data_pecc_keys ON public.user_data;
CREATE TRIGGER trg_guard_legacy_user_data_pecc_keys
  BEFORE INSERT OR UPDATE ON public.user_data
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_legacy_user_data_pecc_keys();

-- Default setting off (safe no-op) until explicitly enabled during cutover.
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('disable_legacy_user_data_pecc_keys', 'false'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

COMMIT;
