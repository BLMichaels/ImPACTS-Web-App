-- PECC Simulation tab: admin-managed list of simulations (name, url, learning objectives, additional resources).
-- All fields optional. Run in Supabase SQL Editor.

create table if not exists public.pecc_simulations (
  id uuid primary key default gen_random_uuid(),
  name text null,
  url text null,
  learning_objectives text null,
  additional_resources jsonb null default '[]',
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.pecc_simulations.name is 'Simulation name (optional).';
comment on column public.pecc_simulations.url is 'URL for the name link (optional).';
comment on column public.pecc_simulations.learning_objectives is 'Learning objectives, one per line (optional).';
comment on column public.pecc_simulations.additional_resources is 'Array of {name, url} for additional resources (optional).';

create index if not exists idx_pecc_simulations_display_order on public.pecc_simulations(display_order);

alter table public.pecc_simulations enable row level security;

drop policy if exists "Anyone authenticated can read pecc_simulations" on public.pecc_simulations;
create policy "Anyone authenticated can read pecc_simulations"
  on public.pecc_simulations for select using (auth.uid() is not null);

drop policy if exists "Admins can manage pecc_simulations" on public.pecc_simulations;
create policy "Admins can manage pecc_simulations"
  on public.pecc_simulations for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

grant select on public.pecc_simulations to authenticated;
grant insert, update, delete on public.pecc_simulations to authenticated;

create or replace function public.set_pecc_simulations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
drop trigger if exists pecc_simulations_updated_at on public.pecc_simulations;
create trigger pecc_simulations_updated_at
  before update on public.pecc_simulations
  for each row execute function public.set_pecc_simulations_updated_at();
