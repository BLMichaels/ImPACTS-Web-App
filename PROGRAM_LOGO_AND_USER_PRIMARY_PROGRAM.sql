-- Program logo URL (uploaded to Storage, URL stored here) and user primary program (which program's logo shows in navbar).
-- Run in Supabase SQL Editor.
--
-- Storage: create a bucket named "program-logos" (public or with read policy for authenticated).
-- Admins upload logo images; this column stores the public URL.

-- Programs: logo image URL (from Supabase Storage or external)
alter table public.programs
  add column if not exists logo_url text null;

comment on column public.programs.logo_url is 'Public URL of the program logo image (e.g. from Storage bucket program-logos). Shown in navbar when user has this as primary program.';

-- Users: primary program (one of the programs they belong to; determines which logo shows in top left)
alter table public.users
  add column if not exists primary_program_id uuid null references public.programs(id) on delete set null;

create index if not exists idx_users_primary_program_id on public.users(primary_program_id);
comment on column public.users.primary_program_id is 'Program whose logo is shown in the navbar for this user. User can be in multiple programs; this picks which logo to display.';
