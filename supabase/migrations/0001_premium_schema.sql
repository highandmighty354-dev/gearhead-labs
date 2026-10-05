-- Gearhead Labs Premium — schema, Row Level Security and signup trigger (Supabase / PostgreSQL).
-- Apply with the Supabase CLI (`supabase db push`) or the SQL editor. Contains no secrets.
--
-- Security model
--   * Every table has RLS enabled. Users can only see and change their own rows.
--   * Entitlements are READ-ONLY to clients. Only the service role (a future Stripe
--     webhook / server function) can grant, extend or revoke Premium.
--   * Premium is enforced in the database: creating or editing garage, project and
--     analysis rows requires an active Premium entitlement (has_premium()).
--   * Users can always read and delete their own data, even after Premium lapses.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- shared helpers
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text,
  display_name          text check (char_length(display_name) <= 80),
  avatar_url            text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)),
  location              text check (char_length(location) <= 80),
  experience_level      text check (experience_level in ('Beginner','Enthusiast','Experienced','Professional')),
  preferred_unit_system text not null default 'imperial' check (preferred_unit_system in ('imperial','metric')),
  favorite_vehicle_id   uuid,
  favorite_build_id     uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------- entitlements
create table public.entitlements (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  plan                 text not null default 'FREE' check (plan in ('FREE','PREMIUM','PREMIUM_TRIAL')),
  status               text not null default 'active' check (status in ('active','trialing','past_due','canceled','expired')),
  started_at           timestamptz not null default now(),
  expires_at           timestamptz,
  provider             text,            -- e.g. 'stripe' (future), 'manual'
  provider_customer_id text,
  updated_at           timestamptz not null default now()
);

-- True when the CURRENT user holds an active Premium or trial entitlement.
create or replace function public.has_premium() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = auth.uid()
      and e.plan in ('PREMIUM','PREMIUM_TRIAL')
      and e.status in ('active','trialing')
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- ---------------------------------------------------------------- vehicles (automotive only)
create table public.vehicles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year         int  not null check (year between 1886 and 2100),
  make         text not null check (char_length(make) between 1 and 60),
  model        text not null check (char_length(model) between 1 and 60),
  trim         text check (char_length(trim) <= 60),
  engine       text check (char_length(engine) <= 80),
  fuel_type    text check (fuel_type in ('Gasoline','Diesel','E85 / Flex Fuel','Methanol','Electric','Hybrid','Plug-in Hybrid','Other')),
  transmission text check (transmission in ('Manual','Automatic','DCT','CVT','Sequential','Single-speed (EV)')),
  drivetrain   text check (drivetrain in ('RWD','FWD','AWD','4WD')),
  vehicle_type text not null check (vehicle_type in ('Car','Truck','SUV','Van','Motorcycle','Off-Road','Race Car')),
  notes        text check (char_length(notes) <= 2000),
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index vehicles_one_primary_per_user on public.vehicles(user_id) where is_primary;
create index vehicles_user_idx on public.vehicles(user_id);

-- ---------------------------------------------------------------- builds
create table public.builds (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  status      text not null default 'Stock' check (status in ('Stock','Street','Street/Strip','Race','Project')),
  goals       text check (char_length(goals) <= 1000),
  notes       text check (char_length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index builds_vehicle_idx on public.builds(vehicle_id);

-- ---------------------------------------------------------------- projects
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 1000),
  vehicle_id  uuid references public.vehicles(id) on delete set null,
  build_id    uuid references public.builds(id) on delete set null,
  status      text not null default 'Planning' check (status in ('Planning','Active','On Hold','Complete')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index projects_user_idx on public.projects(user_id);

-- ---------------------------------------------------------------- engineering analyses
create table public.engineering_analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id  uuid references public.vehicles(id) on delete set null,
  build_id    uuid references public.builds(id) on delete set null,
  project_id  uuid references public.projects(id) on delete set null,
  analyzer_id text not null check (analyzer_id in (
    'e01_turbo_compressor_map','e02_turbo_surge_choke_margin','e03_turbo_turbine_matching','e04_turbo_pressure_ratio_stack',
    'e05_two_stroke_time_area','e06_two_stroke_blowdown','e07_expansion_chamber_reverse','e08_valvetrain_dynamic_control',
    'e09_valve_spring_surge','e10_suspension_kinematics','e11_driveline_dynamics','e12_radiator_heat_rejection',
    'e13_intercooler_thermal','e14_heat_exchanger_matching')),
  name        text not null check (char_length(name) between 1 and 120),
  input_data  jsonb not null check (jsonb_typeof(input_data) = 'object'),
  result_data jsonb check (result_data is null or jsonb_typeof(result_data) = 'object'),
  notes       text check (char_length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index analyses_user_idx on public.engineering_analyses(user_id);

alter table public.profiles
  add constraint profiles_favorite_vehicle_fk foreign key (favorite_vehicle_id) references public.vehicles(id) on delete set null,
  add constraint profiles_favorite_build_fk   foreign key (favorite_build_id)   references public.builds(id)   on delete set null;

-- ---------------------------------------------------------------- updated_at triggers
create trigger profiles_updated     before update on public.profiles             for each row execute function public.set_updated_at();
create trigger entitlements_updated before update on public.entitlements         for each row execute function public.set_updated_at();
create trigger vehicles_updated     before update on public.vehicles             for each row execute function public.set_updated_at();
create trigger builds_updated       before update on public.builds               for each row execute function public.set_updated_at();
create trigger projects_updated     before update on public.projects             for each row execute function public.set_updated_at();
create trigger analyses_updated     before update on public.engineering_analyses for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- signup: profile + FREE entitlement
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name) values (new.id, new.email, split_part(new.email, '@', 1));
  insert into public.entitlements (user_id, plan, status, provider) values (new.id, 'FREE', 'active', null);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- Row Level Security
alter table public.profiles             enable row level security;
alter table public.entitlements         enable row level security;
alter table public.vehicles             enable row level security;
alter table public.builds               enable row level security;
alter table public.projects             enable row level security;
alter table public.engineering_analyses enable row level security;

-- profiles: own row only; created by the signup trigger, removed with the auth user.
create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (
  id = auth.uid()
  and (favorite_vehicle_id is null or exists (select 1 from public.vehicles v where v.id = favorite_vehicle_id and v.user_id = auth.uid()))
  and (favorite_build_id   is null or exists (select 1 from public.builds   b where b.id = favorite_build_id   and b.user_id = auth.uid())));

-- entitlements: clients may read their own row. No insert/update/delete policies:
-- only the service role (which bypasses RLS) can write entitlements.
create policy entitlements_select on public.entitlements for select using (user_id = auth.uid());

-- vehicles
create policy vehicles_select on public.vehicles for select using (user_id = auth.uid());
create policy vehicles_insert on public.vehicles for insert with check (user_id = auth.uid() and public.has_premium());
create policy vehicles_update on public.vehicles for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_premium());
create policy vehicles_delete on public.vehicles for delete using (user_id = auth.uid());

-- builds: the parent vehicle must belong to the same user.
create policy builds_select on public.builds for select using (user_id = auth.uid());
create policy builds_insert on public.builds for insert with check (user_id = auth.uid() and public.has_premium()
  and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()));
create policy builds_update on public.builds for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_premium()
  and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()));
create policy builds_delete on public.builds for delete using (user_id = auth.uid());

-- projects: referenced vehicle/build must belong to the same user.
create policy projects_select on public.projects for select using (user_id = auth.uid());
create policy projects_insert on public.projects for insert with check (user_id = auth.uid() and public.has_premium()
  and (vehicle_id is null or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()))
  and (build_id   is null or exists (select 1 from public.builds   b where b.id = build_id   and b.user_id = auth.uid())));
create policy projects_update on public.projects for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_premium()
  and (vehicle_id is null or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()))
  and (build_id   is null or exists (select 1 from public.builds   b where b.id = build_id   and b.user_id = auth.uid())));
create policy projects_delete on public.projects for delete using (user_id = auth.uid());

-- engineering analyses: referenced vehicle/build/project must belong to the same user.
create policy analyses_select on public.engineering_analyses for select using (user_id = auth.uid());
create policy analyses_insert on public.engineering_analyses for insert with check (user_id = auth.uid() and public.has_premium()
  and (vehicle_id is null or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()))
  and (build_id   is null or exists (select 1 from public.builds   b where b.id = build_id   and b.user_id = auth.uid()))
  and (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())));
create policy analyses_update on public.engineering_analyses for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_premium()
  and (vehicle_id is null or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()))
  and (build_id   is null or exists (select 1 from public.builds   b where b.id = build_id   and b.user_id = auth.uid()))
  and (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())));
create policy analyses_delete on public.engineering_analyses for delete using (user_id = auth.uid());

-- Clients never write entitlements, even if a policy were added by mistake.
revoke insert, update, delete on public.entitlements from anon, authenticated;
revoke all on function public.has_premium() from anon;
