-- Usage events table for analytics (page views, logins, clicks, etc.).
-- Run in Supabase SQL Editor if usage_events 400 occurs.

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  event_type text not null,
  path text not null default '/',
  metadata jsonb not null default '{}',
  hospital_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_user_id on public.usage_events(user_id);
create index if not exists idx_usage_events_created_at on public.usage_events(created_at);
create index if not exists idx_usage_events_event_type on public.usage_events(event_type);

alter table public.usage_events enable row level security;

-- Only admins can read all events (for Snapshot); users don't need to read this table from the client
drop policy if exists "Admins can read usage_events" on public.usage_events;
create policy "Admins can read usage_events"
  on public.usage_events for select
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Authenticated users can insert their own events (for analytics tracking)
drop policy if exists "Users can insert own usage_events" on public.usage_events;
create policy "Users can insert own usage_events"
  on public.usage_events for insert
  with check (auth.uid() = user_id);

grant select, insert on public.usage_events to authenticated;
