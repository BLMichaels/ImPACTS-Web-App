-- Prevent clients from clearing the legacy-password enforcement flag without using the RPC.
-- Run in Supabase SQL Editor (production).

CREATE OR REPLACE FUNCTION public.guard_password_update_required_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_key = 'password_update_required' THEN
    IF NEW.value IS NOT DISTINCT FROM 'false'::jsonb THEN
      RAISE EXCEPTION 'password_update_required cannot be cleared via direct write';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_password_update_required_writes ON public.user_data;
CREATE TRIGGER trg_guard_password_update_required_writes
  BEFORE INSERT OR UPDATE ON public.user_data
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_password_update_required_writes();

CREATE OR REPLACE FUNCTION public.guard_password_update_required_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.data_key = 'password_update_required'
     AND current_setting('app.clear_password_update_required', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'password_update_required cannot be deleted directly';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_password_update_required_delete ON public.user_data;
CREATE TRIGGER trg_guard_password_update_required_delete
  BEFORE DELETE ON public.user_data
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_password_update_required_delete();

CREATE OR REPLACE FUNCTION public.clear_password_update_required()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  PERFORM set_config('app.clear_password_update_required', '1', true);
  DELETE FROM public.user_data
  WHERE user_id = auth.uid()
    AND data_key = 'password_update_required';
END;
$$;

REVOKE ALL ON FUNCTION public.clear_password_update_required() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_password_update_required() TO authenticated;
