-- SCORM packages (MVP): store course metadata; assets live in Supabase Storage.
-- Run in Supabase SQL Editor.
--
-- Storage requirement:
-- 1) Create a Storage bucket named: scorm
-- 2) Make it public OR add a policy that allows authenticated users to read objects.
-- 3) For uploads: allow admins/managers/mentors to write objects (or keep uploads as service-side later).
--
-- Notes:
-- - This is a "launch + catalog" MVP. Progress tracking can be added later.
-- - site_id is optional; when set, it can scope packages to a hospital/site.

create table if not exists public.scorm_packages (
  id uuid primary key default gen_random_uuid(),
  site_id text null,
  title text not null,
  description text null,
  -- Storage prefix is the folder within the scorm bucket, e.g. "packages/<id>"
  storage_prefix text not null,
  -- Entry point relative to prefix, e.g. "index.html" or "story.html"
  entry_path text not null default 'index.html',
  manifest_path text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scorm_packages_site_id on public.scorm_packages(site_id);

alter table public.scorm_packages enable row level security;

-- Anyone signed in can read packages (optionally scoped later by site_id)
drop policy if exists "Signed-in users read scorm_packages" on public.scorm_packages;
create policy "Signed-in users read scorm_packages"
  on public.scorm_packages for select
  using (auth.uid() is not null);

-- Admins/managers/mentors can manage packages
drop policy if exists "Admins/managers/mentors manage scorm_packages" on public.scorm_packages;
create policy "Admins/managers/mentors manage scorm_packages"
  on public.scorm_packages for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'manager', 'mentor')
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'manager', 'mentor')
    )
  );

-- Updated-at helper (optional)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_scorm_packages_updated_at on public.scorm_packages;
create trigger tr_scorm_packages_updated_at
before update on public.scorm_packages
for each row execute function public.set_updated_at();

