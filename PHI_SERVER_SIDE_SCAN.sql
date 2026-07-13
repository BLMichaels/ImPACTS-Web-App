-- Server-side high-severity PHI backstop (defense in depth).
-- Client PhiGuard remains the primary UX (block + medium acknowledgment).
-- This rejects clearly high-risk patterns even if the client is bypassed.
-- Does NOT store raw PHI — only raises an error / optional security_events row.

CREATE OR REPLACE FUNCTION public.phi_is_data_url_blob(t text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT t IS NOT NULL
    AND length(t) > 120
    AND (
      lower(left(t, 30)) LIKE 'data:%'
      OR t ~ '^[A-Za-z0-9+/=]{200,}$'
    );
$$;

CREATE OR REPLACE FUNCTION public.phi_collect_json_text(v jsonb, OUT out_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  skip_keys text[] := ARRAY[
    'id','user_id','hospital_id','facility_id','email','phone','fax',
    'first_name','last_name','name','contactName','contact_name','department',
    'owner','assignee','assignedTo','assigned_to','assignedBy',
    'leadSenior','lead_senior','teamMember','team_member','teamMembers',
    'projectLead','projectSponsor','projectAdmin','consulted','informed',
    'reachOutToLeadAuthor','interestedCoAuthors','vendor','participants',
    'address','city','state','zip','zip_code','county','region',
    'created_at','updated_at','date','activityDate','startDate','endDate',
    'role','status','type','url','fileData','file_data','fileName','file_name'
  ];
  elem jsonb;
  k text;
  child text;
  acc text := '';
BEGIN
  IF v IS NULL OR v = 'null'::jsonb THEN
    RETURN '';
  END IF;

  IF jsonb_typeof(v) = 'string' THEN
    child := v #>> '{}';
    IF public.phi_is_data_url_blob(child) THEN
      RETURN '';
    END IF;
    RETURN coalesce(child, '');
  END IF;

  IF jsonb_typeof(v) = 'number' OR jsonb_typeof(v) = 'boolean' THEN
    RETURN '';
  END IF;

  IF jsonb_typeof(v) = 'array' THEN
    FOR elem IN SELECT value FROM jsonb_array_elements(v)
    LOOP
      child := public.phi_collect_json_text(elem);
      IF child <> '' THEN
        acc := acc || E'\n' || child;
      END IF;
    END LOOP;
    RETURN acc;
  END IF;

  IF jsonb_typeof(v) = 'object' THEN
    FOR k, elem IN SELECT key, value FROM jsonb_each(v)
    LOOP
      IF k = ANY (skip_keys) THEN
        CONTINUE;
      END IF;
      child := public.phi_collect_json_text(elem);
      IF child <> '' THEN
        acc := acc || E'\n' || child;
      END IF;
    END LOOP;
    RETURN acc;
  END IF;

  RETURN '';
END;
$$;

-- Returns a short category label if high-severity PHI heuristics match; else NULL.
CREATE OR REPLACE FUNCTION public.phi_high_severity_category(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text := coalesce(raw, '');
BEGIN
  IF length(trim(t)) = 0 THEN
    RETURN NULL;
  END IF;

  -- SSN
  IF t ~* '\y\d{3}-\d{2}-\d{4}\y' OR t ~* '\ySSN\s*[:#]?\s*\d{3}' THEN
    RETURN 'ssn';
  END IF;

  -- Medical record / MRN
  IF t ~* '\y(?:MRN|medical\s*record(?:\s*number)?)\s*[:#]?\s*[A-Z0-9-]{4,}' THEN
    RETURN 'mrn';
  END IF;

  -- Health plan beneficiary id
  IF t ~* '\y(?:member\s*id|beneficiary\s*(?:id|number)|health\s*plan\s*id)\s*[:#]?\s*[A-Z0-9-]{5,}' THEN
    RETURN 'health_plan_id';
  END IF;

  -- Explicit patient / infant / neonate + person-like name
  IF t ~* '\y(?:patient|pt\.?)(?:''s)?\s+(?:named\s+|name\s*[:-]\s*)?[A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2}\y' THEN
    RETURN 'patient_name';
  END IF;
  IF t ~* '\y(?:infant|neonate)\s+(?:named\s+)?[A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2}\y' THEN
    RETURN 'patient_name';
  END IF;

  -- Labeled DOB / admission / discharge date (full date)
  IF t ~* '\y(?:DOB|date\s*of\s*birth|admission\s*date|discharge\s*date)\s*[:#]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}' THEN
    RETURN 'individual_date';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.phi_reject_if_high(surface text, content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat text;
BEGIN
  cat := public.phi_high_severity_category(content);
  IF cat IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.security_events (event_type, user_id, metadata, created_at)
    VALUES (
      'phi_input_blocked',
      auth.uid(),
      jsonb_build_object(
        'surface', surface,
        'severity', 'high',
        'serverSide', true,
        'categoryLabels', jsonb_build_array(cat),
        'findingCount', 1
      ),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the block solely because logging failed
    NULL;
  END;

  RAISE EXCEPTION 'PHI_BLOCKED: possible high-risk patient identifier detected (%). Remove patient PHI and try again.', cat
    USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.phi_guard_user_or_hospital_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  narrative_keys text[] := ARRAY[
    'gapPlans','activities','mentorActivities','simulation_sessions','simulation_gaps',
    'gap_closure_question_notes','dashboard_department_contacts','mentorHospitals',
    'mentorContacts','prismActivities','mentorWages',
    'admin_project_pipeline_simbox','admin_project_pipeline_scholarship',
    'admin_project_pipeline_research_dissemination','admin_project_pipeline_abstracts',
    'prsQuestions','dashboard_resources'
  ];
  extracted text;
BEGIN
  IF NEW.data_key IS NULL OR NOT (NEW.data_key = ANY (narrative_keys)) THEN
    RETURN NEW;
  END IF;
  extracted := public.phi_collect_json_text(NEW.value);
  PERFORM public.phi_reject_if_high('data_key:' || NEW.data_key, extracted);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phi_guard_user_data ON public.user_data;
CREATE TRIGGER trg_phi_guard_user_data
  BEFORE INSERT OR UPDATE OF value, data_key ON public.user_data
  FOR EACH ROW
  EXECUTE FUNCTION public.phi_guard_user_or_hospital_data();

DROP TRIGGER IF EXISTS trg_phi_guard_hospital_data ON public.hospital_data;
CREATE TRIGGER trg_phi_guard_hospital_data
  BEFORE INSERT OR UPDATE OF value, data_key ON public.hospital_data
  FOR EACH ROW
  EXECUTE FUNCTION public.phi_guard_user_or_hospital_data();

CREATE OR REPLACE FUNCTION public.phi_guard_crm_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  extracted text;
BEGIN
  extracted := coalesce(NEW.notes, '');
  IF NEW.notes_log IS NOT NULL THEN
    extracted := extracted || E'\n' || public.phi_collect_json_text(NEW.notes_log);
  END IF;
  PERFORM public.phi_reject_if_high('crm_organizations', extracted);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phi_guard_crm_organizations ON public.crm_organizations;
CREATE TRIGGER trg_phi_guard_crm_organizations
  BEFORE INSERT OR UPDATE OF notes, notes_log ON public.crm_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.phi_guard_crm_notes();

CREATE OR REPLACE FUNCTION public.phi_guard_hospital_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  extracted text;
BEGIN
  extracted := coalesce(NEW.notes, '');
  IF NEW.notes_log IS NOT NULL THEN
    extracted := extracted || E'\n' || public.phi_collect_json_text(NEW.notes_log);
  END IF;
  PERFORM public.phi_reject_if_high('hospitals', extracted);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phi_guard_hospitals ON public.hospitals;
CREATE TRIGGER trg_phi_guard_hospitals
  BEFORE INSERT OR UPDATE OF notes, notes_log ON public.hospitals
  FOR EACH ROW
  EXECUTE FUNCTION public.phi_guard_hospital_notes();

CREATE OR REPLACE FUNCTION public.phi_guard_checklist_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.phi_reject_if_high('program_checklist_tasks', coalesce(NEW.text_content, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phi_guard_checklist_tasks ON public.program_checklist_tasks;
CREATE TRIGGER trg_phi_guard_checklist_tasks
  BEFORE INSERT OR UPDATE OF text_content ON public.program_checklist_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.phi_guard_checklist_task();
