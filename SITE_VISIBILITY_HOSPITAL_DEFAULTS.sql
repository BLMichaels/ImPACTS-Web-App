-- Hospital-level visibility defaults for PECC pages.
-- Ensures site_tab_visibility is seeded per site and can serve as hospital default visibility.

BEGIN;

-- Seed default visible tabs for every known site/hospital reference in hospitals.
WITH base_sites AS (
  SELECT DISTINCT COALESCE(NULLIF(TRIM(COALESCE(to_jsonb(h)->>'facility_id', '')), ''), h.id::TEXT) AS site_id
  FROM public.hospitals h
),
default_tabs AS (
  SELECT unnest(ARRAY['activities', 'snapshot', 'milestones', 'education', 'gap-plan', 'simulation']) AS tab_key
)
INSERT INTO public.site_tab_visibility (site_id, tab_key, visible, updated_by, updated_at)
SELECT
  s.site_id,
  t.tab_key,
  true,
  NULL,
  NOW()
FROM base_sites s
CROSS JOIN default_tabs t
WHERE s.site_id IS NOT NULL
ON CONFLICT (site_id, tab_key)
DO NOTHING;

-- Optional helper for syncing a user-level override to site default (admin/manager workflows).
CREATE OR REPLACE FUNCTION public.set_site_tab_default_visibility(
  p_site_id TEXT,
  p_tab_key TEXT,
  p_visible BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_uid
      AND (u.role IN ('admin', 'manager') OR COALESCE(u.is_admin, false))
  ) THEN
    RAISE EXCEPTION 'Not authorized to set site default visibility';
  END IF;

  INSERT INTO public.site_tab_visibility (site_id, tab_key, visible, updated_by, updated_at)
  VALUES (p_site_id, p_tab_key, p_visible, v_uid, NOW())
  ON CONFLICT (site_id, tab_key)
  DO UPDATE
    SET visible = EXCLUDED.visible,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'ok', true,
    'site_id', p_site_id,
    'tab_key', p_tab_key,
    'visible', p_visible
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_site_tab_default_visibility(TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_site_tab_default_visibility(TEXT, TEXT, BOOLEAN) TO authenticated;

COMMIT;
