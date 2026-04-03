-- Durable rate limiting for Supabase Edge Functions (service role writes; RLS blocks normal users).
-- Run in Supabase SQL Editor once. Used by complete-invitation-registration (falls back to in-memory if missing).

CREATE TABLE IF NOT EXISTS public.edge_function_rate_limits (
  bucket_key text PRIMARY KEY,
  hit_count int NOT NULL DEFAULT 0,
  window_start_ms bigint NOT NULL
);

COMMENT ON TABLE public.edge_function_rate_limits IS 'Edge function rate limit buckets; only service role should write.';

ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;
