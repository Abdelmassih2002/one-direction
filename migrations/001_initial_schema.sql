-- ONE DIRECTION — Initial schema (Migration 001)
-- Enables Row Level Security on every user-owned table.
-- owner_id references auth.users.id (Supabase Auth).

create extension if not exists "uuid-ossp";

-- ============================================
-- profiles
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  week_start text not null default 'monday',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
  on public.profiles for delete
  using (auth.uid() = id);

-- ============================================
-- life_areas
-- ============================================
create table public.life_areas (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#2563eb',
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.life_areas enable row level security;

create index life_areas_owner_idx on public.life_areas(owner_id);
create index life_areas_owner_archived_idx on public.life_areas(owner_id, archived_at);
create index life_areas_owner_sort_idx on public.life_areas(owner_id, sort_order);

drop policy if exists life_areas_all_own on public.life_areas;
create policy life_areas_all_own
  on public.life_areas for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ============================================
-- goals
-- ============================================
create table public.goals (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  life_area_id uuid references public.life_areas(id) on delete set null,
  title text not null,
  description text,
  metric text,
  status text not null default 'planned',
  progress integer not null default 0 check (progress between 0 and 100),
  target_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create index goals_owner_idx on public.goals(owner_id);
create index goals_owner_status_idx on public.goals(owner_id, status);
create index goals_owner_life_area_idx on public.goals(owner_id, life_area_id);

drop policy if exists goals_all_own on public.goals;
create policy goals_all_own
  on public.goals for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ============================================
-- focus_cycles
-- ============================================
create table public.focus_cycles (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  duration_weeks integer not null default 4 check (duration_weeks between 2 and 6),
  active boolean not null default true,
  outcome text check (outcome in ('achieved','progress','direction_change','paused')),
  outcome_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.focus_cycles enable row level security;

create index focus_cycles_owner_idx on public.focus_cycles(owner_id);
create index focus_cycles_owner_active_idx on public.focus_cycles(owner_id, active);

create unique index focus_cycles_one_active_per_owner
  on public.focus_cycles(owner_id)
  where active = true;

drop policy if exists focus_cycles_all_own on public.focus_cycles;
create policy focus_cycles_all_own
  on public.focus_cycles for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
