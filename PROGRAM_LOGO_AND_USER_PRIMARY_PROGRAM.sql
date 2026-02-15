-- Program logo URL (uploaded to Storage, URL stored here) and user primary program (which program's logo shows in navbar).
-- Run in Supabase SQL Editor.
--
-- Storage: create bucket "program-logos" (public) and policies so admins can upload and anyone can read.

INSERT INTO storage.buckets (id, name, public)
VALUES ('program-logos', 'program-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/update/delete program logos (admin Programs page)
DROP POLICY IF EXISTS "Authenticated can manage program logos" ON storage.objects;
CREATE POLICY "Authenticated can manage program logos" ON storage.objects
  FOR ALL USING (bucket_id = 'program-logos' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'program-logos' AND auth.role() = 'authenticated');

-- Allow public read for program logos (navbar and CRM show logo URLs)
DROP POLICY IF EXISTS "Public read program logos" ON storage.objects;
CREATE POLICY "Public read program logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'program-logos');

-- Programs: logo image URL (from Supabase Storage or external)
alter table public.programs
  add column if not exists logo_url text null;

comment on column public.programs.logo_url is 'Public URL of the program logo image (e.g. from Storage bucket program-logos). Shown in navbar when user has this as primary program.';

-- Users: primary program (one of the programs they belong to; determines which logo shows in top left)
alter table public.users
  add column if not exists primary_program_id uuid null references public.programs(id) on delete set null;

create index if not exists idx_users_primary_program_id on public.users(primary_program_id);
comment on column public.users.primary_program_id is 'Program whose logo is shown in the navbar for this user. User can be in multiple programs; this picks which logo to display.';
