-- SCORM packages update: admin-only management + scoping to hospitals/programs.
-- Run AFTER SCORM_PACKAGES_MIGRATION.sql

alter table public.scorm_packages
  add column if not exists applies_to_all boolean not null default true;

alter table public.scorm_packages
  add column if not exists applies_to_site_ids text[] null;

alter table public.scorm_packages
  add column if not exists applies_to_programs text[] null;

-- Tighten management policy: ONLY admins can create/update/delete packages.
drop policy if exists "Admins/managers/mentors manage scorm_packages" on public.scorm_packages;
drop policy if exists "Admins manage scorm_packages" on public.scorm_packages;
create policy "Admins manage scorm_packages"
  on public.scorm_packages for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

