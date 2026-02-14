-- SCORM packages: placement (where it appears) + full visibility control (cohorts, programs, users, states, hospitals).
-- Run AFTER SCORM_PACKAGES_MIGRATION.sql and SCORM_PACKAGES_SCOPING_AND_ADMIN_ONLY.sql.
--
-- Placement: each package appears in exactly one place (education tab, cohort, simulation, checklist).
-- Visibility: admin chooses who can see it (all, or restrict to specific cohorts/programs/users/states/hospitals).

-- Placement: where the package is shown in the app
alter table public.scorm_packages
  add column if not exists placement text not null default 'education'
  check (placement in ('education', 'cohort', 'simulation', 'checklist'));

comment on column public.scorm_packages.placement is 'Where this package is shown: education tab, cohort page, simulation page, or checklist page.';

-- Visibility: restrict to specific cohorts (package visible only to users in these cohorts when placement is cohort or in that context)
alter table public.scorm_packages
  add column if not exists applies_to_cohort_ids uuid[] null;

-- Visibility: restrict to specific users (package visible only to these user ids)
alter table public.scorm_packages
  add column if not exists applies_to_user_ids uuid[] null;

-- Visibility: restrict to specific states (package visible to users whose primary site is in these states)
alter table public.scorm_packages
  add column if not exists applies_to_states text[] null;

-- Order within a placement (lower = first)
alter table public.scorm_packages
  add column if not exists display_order integer not null default 0;

comment on column public.scorm_packages.applies_to_cohort_ids is 'If set (and applies_to_all false), package visible only to users in these cohorts.';
comment on column public.scorm_packages.applies_to_user_ids is 'If set (and applies_to_all false), package visible only to these user IDs.';
comment on column public.scorm_packages.applies_to_states is 'If set (and applies_to_all false), package visible only to users whose site is in these states.';
comment on column public.scorm_packages.display_order is 'Order within the same placement; lower numbers first.';

create index if not exists idx_scorm_packages_placement on public.scorm_packages(placement);
