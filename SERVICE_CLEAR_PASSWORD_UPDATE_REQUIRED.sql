-- Lets the provision edge function clear stale password_update_required flags
-- after an admin sets a starting password (service role only).
-- Run in Supabase SQL Editor (production).

CREATE OR REPLACE FUNCTION public.service_clear_password_update_required(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('app.clear_password_update_required', '1', true);
  DELETE FROM public.user_data
  WHERE user_id = p_user_id
    AND data_key = 'password_update_required';
END;
$$;

REVOKE ALL ON FUNCTION public.service_clear_password_update_required(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_clear_password_update_required(uuid) TO service_role;
