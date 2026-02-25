-- Mentor and manager notes on hospitals: sync to CRM so admins see them on the hospital's CRM page.
-- Run in Supabase SQL Editor. Requires: hospitals (with notes_log), mentor_hospital_assignments, users.

CREATE OR REPLACE FUNCTION public.append_hospital_note(
  p_hospital_id text,
  p_note_date text,
  p_note_text text,
  p_note_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital_uuid uuid;
  v_current_log jsonb;
  v_new_entry jsonb;
BEGIN
  -- Resolve hospital by id (uuid) or facility_id
  SELECT id INTO v_hospital_uuid
  FROM public.hospitals
  WHERE (id::text = p_hospital_id OR facility_id = p_hospital_id)
  LIMIT 1;

  IF v_hospital_uuid IS NULL THEN
    RETURN;
  END IF;

  -- Ensure caller is a mentor assigned to this hospital, or a manager
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'manager'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    INNER JOIN public.mentor_hospital_assignments mha ON mha.mentor_id = u.id
    WHERE u.id = auth.uid()
      AND u.role = 'mentor'
      AND mha.hospital_id = v_hospital_uuid
      AND (mha.is_active = true OR mha.is_active IS NULL)
  ) THEN
    RETURN;
  END IF;

  -- Append note to notes_log (id and author_id allow edit/delete by author only)
  SELECT COALESCE(notes_log, '[]'::jsonb) INTO v_current_log
  FROM public.hospitals
  WHERE id = v_hospital_uuid;

  v_new_entry := jsonb_build_object(
    'id', COALESCE(NULLIF(trim(p_note_id), ''), gen_random_uuid()::text),
    'date', p_note_date,
    'text', p_note_text,
    'author_id', auth.uid()::text
  );
  v_current_log := v_current_log || v_new_entry;

  UPDATE public.hospitals
  SET notes_log = v_current_log,
      updated_at = now()
  WHERE id = v_hospital_uuid;
END;
$$;

COMMENT ON FUNCTION public.append_hospital_note(text, text, text, text) IS
  'Allows mentors (assigned to that hospital) and managers to append a dated note to a hospital notes_log. Optional p_note_id for client-provided id. Notes appear on the hospital CRM page for admins.';

-- Remove a note: only if the note's author_id matches the caller (mentor/manager).
CREATE OR REPLACE FUNCTION public.delete_hospital_note(
  p_hospital_id text,
  p_note_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital_uuid uuid;
  v_current_log jsonb;
  v_new_log jsonb;
BEGIN
  SELECT id INTO v_hospital_uuid
  FROM public.hospitals
  WHERE (id::text = p_hospital_id OR facility_id = p_hospital_id)
  LIMIT 1;

  IF v_hospital_uuid IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'manager'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    INNER JOIN public.mentor_hospital_assignments mha ON mha.mentor_id = u.id
    WHERE u.id = auth.uid() AND u.role = 'mentor'
      AND mha.hospital_id = v_hospital_uuid
      AND (mha.is_active = true OR mha.is_active IS NULL)
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(notes_log, '[]'::jsonb) INTO v_current_log
  FROM public.hospitals
  WHERE id = v_hospital_uuid;

  -- Keep only elements that are NOT (id = p_note_id AND author_id = caller)
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_new_log
  FROM jsonb_array_elements(v_current_log) AS t(elem)
  WHERE NOT (elem->>'id' = p_note_id AND elem->>'author_id' = auth.uid()::text);

  UPDATE public.hospitals
  SET notes_log = v_new_log,
      updated_at = now()
  WHERE id = v_hospital_uuid;
END;
$$;

COMMENT ON FUNCTION public.delete_hospital_note(text, text) IS
  'Allows mentors/managers to delete only their own note (author_id = caller) on a hospital.';

-- Update a note: only if the note's author_id matches the caller.
CREATE OR REPLACE FUNCTION public.update_hospital_note(
  p_hospital_id text,
  p_note_id text,
  p_note_date text,
  p_note_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital_uuid uuid;
  v_current_log jsonb;
  v_new_log jsonb;
BEGIN
  SELECT id INTO v_hospital_uuid
  FROM public.hospitals
  WHERE (id::text = p_hospital_id OR facility_id = p_hospital_id)
  LIMIT 1;

  IF v_hospital_uuid IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'manager'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    INNER JOIN public.mentor_hospital_assignments mha ON mha.mentor_id = u.id
    WHERE u.id = auth.uid() AND u.role = 'mentor'
      AND mha.hospital_id = v_hospital_uuid
      AND (mha.is_active = true OR mha.is_active IS NULL)
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(notes_log, '[]'::jsonb) INTO v_current_log
  FROM public.hospitals
  WHERE id = v_hospital_uuid;

  -- Replace the matching note (same id and author_id) with updated date/text
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN elem->>'id' = p_note_id AND elem->>'author_id' = auth.uid()::text
      THEN jsonb_build_object('id', elem->>'id', 'date', p_note_date, 'text', p_note_text, 'author_id', elem->>'author_id')
      ELSE elem
    END
  ), '[]'::jsonb) INTO v_new_log
  FROM jsonb_array_elements(v_current_log) AS t(elem);

  UPDATE public.hospitals
  SET notes_log = v_new_log,
      updated_at = now()
  WHERE id = v_hospital_uuid;
END;
$$;

COMMENT ON FUNCTION public.update_hospital_note(text, text, text, text) IS
  'Allows mentors/managers to update only their own note (author_id = caller) on a hospital.';

-- Grants
GRANT EXECUTE ON FUNCTION public.append_hospital_note(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_hospital_note(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_hospital_note(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_hospital_note(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_hospital_note(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_hospital_note(text, text, text, text) TO service_role;
