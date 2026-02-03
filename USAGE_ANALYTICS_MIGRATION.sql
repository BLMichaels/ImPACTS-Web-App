-- Usage analytics: logins, page views, time on page, clickthroughs for Admin Snapshot.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'page_view', 'click')),
  path TEXT NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON public.usage_events (created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON public.usage_events (event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_role ON public.usage_events (role);
CREATE INDEX IF NOT EXISTS idx_usage_events_path ON public.usage_events (path);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events only (user_id must match auth.uid())
CREATE POLICY "Users insert own usage events" ON public.usage_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only admins can read (for Admin Snapshot dashboard)
CREATE POLICY "Admins read usage events" ON public.usage_events
  FOR SELECT USING (public.current_user_role() = 'admin');

-- No update/delete from app (admins can delete via SQL if needed for retention)
-- Optional: add a retention policy (e.g. delete events older than 1 year) via cron or Edge Function

COMMENT ON TABLE public.usage_events IS 'Usage analytics: login, page_view, click. metadata: time_spent_seconds, target (click label), etc.';
