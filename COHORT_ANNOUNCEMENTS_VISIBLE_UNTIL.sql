-- Optional visibility end date for cohort announcements.
-- When set, announcements are hidden after this date.

ALTER TABLE public.cohort_announcements
  ADD COLUMN IF NOT EXISTS visible_until DATE;

COMMENT ON COLUMN public.cohort_announcements.visible_until IS 'When set, announcement is hidden after this date. NULL = show until manually removed.';
