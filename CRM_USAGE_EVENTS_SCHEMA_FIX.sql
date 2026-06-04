-- Fixes schema drift causing:
-- 1) crm_organizations PATCH failures when user_id column is missing
-- 2) usage_events INSERT 400 when newer event types are tracked

BEGIN;

ALTER TABLE public.crm_organizations
  ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crm_organizations_user_id_fkey'
      AND conrelid = 'public.crm_organizations'::regclass
  ) THEN
    ALTER TABLE public.crm_organizations
      ADD CONSTRAINT crm_organizations_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_crm_organizations_user_id
  ON public.crm_organizations(user_id);

ALTER TABLE public.usage_events
  DROP CONSTRAINT IF EXISTS usage_events_event_type_check;

ALTER TABLE public.usage_events
  ADD CONSTRAINT usage_events_event_type_check
  CHECK (
    event_type = ANY (
      ARRAY[
        'login'::text,
        'page_view'::text,
        'click'::text,
        'link_click'::text,
        'checklist'::text,
        'activity'::text
      ]
    )
  );

COMMIT;
