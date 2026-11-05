-- ONE DIRECTION — Core domains (Migration 002)
-- Focus cycle goals, projects, milestones, tasks, schedule blocks,
-- focus sessions, daily/weekly reviews. All user-owned tables have RLS
-- with `auth.uid() = owner_id` and cross-owner link validation triggers.

-- ============================================
-- profiles: onboarding + auto-provisioning
-- ============================================
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Timestamp maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================
-- focus_cycles: additional product columns
-- ============================================
alter table public.focus_cycles
  add column if not exists title text,
  add column if not exists reflection text;

alter table public.focus_cycles
  drop constraint if exists focus_cycles_date_order_check;
alter table public.focus_cycles
  add constraint focus_cycles_date_order_check check (end_date >= start_date);

drop trigger if exists focus_cycles_updated_at on public.focus_cycles;
create trigger focus_cycles_updated_at
  before update on public.focus_cycles
  for each row execute function public.set_updated_at();

-- ============================================
-- focus_cycle_goals
-- ============================================
create table if not exists public.focus_cycle_goals (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.focus_cycles(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  role text not null check (role in ('primary', 'secondary', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, goal_id)
);

alter table public.focus_cycle_goals enable row level security;

create index if not exists focus_cycle_goals_owner_idx on public.focus_cycle_goals(owner_id);
create index if not exists focus_cycle_goals_cycle_idx on public.focus_cycle_goals(cycle_id);
create index if not exists focus_cycle_goals_goal_idx on public.focus_cycle_goals(goal_id);

-- Exactly one primary goal per cycle (FOCUSC-02)
create unique index if not exists focus_cycle_goals_one_primary
  on public.focus_cycle_goals(cycle_id)
  where role = 'primary';

drop policy if exists focus_cycle_goals_all_own on public.focus_cycle_goals;
create policy focus_cycle_goals_all_own
  on public.focus_cycle_goals for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists focus_cycle_goals_updated_at on public.focus_cycle_goals;
create trigger focus_cycle_goals_updated_at
  before update on public.focus_cycle_goals
  for each row execute function public.set_updated_at();

-- ============================================
-- projects
-- ============================================
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active'
    check (status in ('planned', 'active', 'on_hold', 'completed', 'archived')),
  starts_on date,
  due_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists projects_owner_status_idx on public.projects(owner_id, status);
create index if not exists projects_goal_idx on public.projects(goal_id);

drop policy if exists projects_all_own on public.projects;
create policy projects_all_own
  on public.projects for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ============================================
-- milestones
-- ============================================
create table if not exists public.milestones (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  due_on date,
  status text not null default 'open' check (status in ('open', 'done')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.milestones enable row level security;

create index if not exists milestones_owner_idx on public.milestones(owner_id);
create index if not exists milestones_project_idx on public.milestones(project_id, sort_order);

drop policy if exists milestones_all_own on public.milestones;
create policy milestones_all_own
  on public.milestones for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists milestones_updated_at on public.milestones;
create trigger milestones_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

-- ============================================
-- tasks (tasks + inbox + subtasks)
-- ============================================
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'inbox'
    check (status in ('inbox', 'todo', 'in_progress', 'done', 'cancelled')),
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes >= 0),
  scheduled_for date,
  due_at timestamptz,
  completed_at timestamptz,
  sort_order integer not null default 0,
  is_top_priority boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create index if not exists tasks_owner_idx on public.tasks(owner_id);
create index if not exists tasks_owner_status_idx on public.tasks(owner_id, status);
create index if not exists tasks_owner_scheduled_idx on public.tasks(owner_id, scheduled_for);
create index if not exists tasks_owner_goal_idx on public.tasks(owner_id, goal_id);
create index if not exists tasks_owner_project_idx on public.tasks(owner_id, project_id);
create index if not exists tasks_parent_idx on public.tasks(parent_task_id);

drop policy if exists tasks_all_own on public.tasks;
create policy tasks_all_own
  on public.tasks for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Business rules enforced in the database (defence in depth).
create or replace function public.validate_task_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_depth integer := 0;
  parent_owner uuid;
  parent_parent uuid;
  steps integer := 0;
begin
  if new.goal_id is not null then
    if not exists (select 1 from public.goals g where g.id = new.goal_id and g.owner_id = new.owner_id) then
      raise exception 'task_goal_owner_mismatch';
    end if;
  end if;

  if new.project_id is not null then
    if not exists (select 1 from public.projects p where p.id = new.project_id and p.owner_id = new.owner_id) then
      raise exception 'task_project_owner_mismatch';
    end if;
  end if;

  if new.milestone_id is not null then
    if not exists (
      select 1 from public.milestones m
      where m.id = new.milestone_id and m.owner_id = new.owner_id
    ) then
      raise exception 'task_milestone_owner_mismatch';
    end if;
  end if;

  if new.parent_task_id is not null then
    select t.owner_id, t.parent_task_id into parent_owner, parent_parent
    from public.tasks t where t.id = new.parent_task_id;

    if parent_owner is null then
      raise exception 'task_parent_missing';
    end if;
    if parent_owner <> new.owner_id then
      raise exception 'task_parent_owner_mismatch';
    end if;

    -- Depth guard (TASK-03): at most 2 nested levels (parent chain length <= 2).
    while parent_parent is not null and steps < 10 loop
      parent_depth := parent_depth + 1;
      select t.parent_task_id into parent_parent from public.tasks t where t.id = parent_parent;
      steps := steps + 1;
    end loop;

    if parent_depth >= 2 then
      raise exception 'task_depth_exceeded';
    end if;
    if new.parent_task_id = new.id then
      raise exception 'task_self_parent';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_validate_links on public.tasks;
create trigger tasks_validate_links
  before insert or update on public.tasks
  for each row execute function public.validate_task_links();

-- Top-3 daily priorities (TASK-07): count is scoped per owner + scheduled day.
create or replace function public.enforce_task_top_priority_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  priority_count integer;
begin
  if new.is_top_priority is distinct from true then
    return new;
  end if;

  if new.scheduled_for is null then
    raise exception 'top_priority_requires_scheduled_date';
  end if;

  select count(*) into priority_count
  from public.tasks
  where owner_id = new.owner_id
    and scheduled_for = new.scheduled_for
    and is_top_priority = true
    and id <> new.id;

  if priority_count >= 3 then
    raise exception 'top_priority_limit_reached';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_top_priority_limit on public.tasks;
create trigger tasks_top_priority_limit
  before insert or update on public.tasks
  for each row execute function public.enforce_task_top_priority_limit();

-- ============================================
-- schedule_blocks
-- ============================================
create table if not exists public.schedule_blocks (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  block_type text not null check (block_type in ('focus', 'rest', 'personal', 'commitment')),
  title text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_blocks_time_order check (end_at > start_at)
);

alter table public.schedule_blocks enable row level security;

create index if not exists schedule_blocks_owner_start_idx on public.schedule_blocks(owner_id, start_at);

drop policy if exists schedule_blocks_all_own on public.schedule_blocks;
create policy schedule_blocks_all_own
  on public.schedule_blocks for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists schedule_blocks_updated_at on public.schedule_blocks;
create trigger schedule_blocks_updated_at
  before update on public.schedule_blocks
  for each row execute function public.set_updated_at();

-- ============================================
-- focus_sessions (timestamp-based timer)
-- ============================================
create table if not exists public.focus_sessions (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  resumed_at timestamptz,
  ended_at timestamptz,
  planned_seconds integer not null default 1500 check (planned_seconds > 0),
  accumulated_seconds integer not null default 0 check (accumulated_seconds >= 0),
  actual_seconds integer check (actual_seconds is null or actual_seconds >= 0),
  status text not null default 'running'
    check (status in ('running', 'paused', 'completed', 'cancelled')),
  interruptions integer not null default 0 check (interruptions >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.focus_sessions enable row level security;

create index if not exists focus_sessions_owner_idx on public.focus_sessions(owner_id, started_at desc);
create index if not exists focus_sessions_task_idx on public.focus_sessions(task_id);

-- One open (not ended) session per user at any time.
create unique index if not exists focus_sessions_one_open
  on public.focus_sessions(owner_id)
  where ended_at is null;

drop policy if exists focus_sessions_all_own on public.focus_sessions;
create policy focus_sessions_all_own
  on public.focus_sessions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists focus_sessions_updated_at on public.focus_sessions;
create trigger focus_sessions_updated_at
  before update on public.focus_sessions
  for each row execute function public.set_updated_at();

-- ============================================
-- daily_reviews
-- ============================================
create table if not exists public.daily_reviews (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  review_date date not null,
  wins text,
  blockers text,
  next_step text,
  gratitude text,
  energy_level integer check (energy_level is null or energy_level between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, review_date)
);

alter table public.daily_reviews enable row level security;

create index if not exists daily_reviews_owner_date_idx on public.daily_reviews(owner_id, review_date desc);

drop policy if exists daily_reviews_all_own on public.daily_reviews;
create policy daily_reviews_all_own
  on public.daily_reviews for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists daily_reviews_updated_at on public.daily_reviews;
create trigger daily_reviews_updated_at
  before update on public.daily_reviews
  for each row execute function public.set_updated_at();

-- ============================================
-- weekly_reviews
-- ============================================
create table if not exists public.weekly_reviews (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  highlights text,
  obstacles text,
  learnings text,
  next_week_focus text,
  keep_focus boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, week_start)
);

alter table public.weekly_reviews enable row level security;

create index if not exists weekly_reviews_owner_week_idx on public.weekly_reviews(owner_id, week_start desc);

drop policy if exists weekly_reviews_all_own on public.weekly_reviews;
create policy weekly_reviews_all_own
  on public.weekly_reviews for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists weekly_reviews_updated_at on public.weekly_reviews;
create trigger weekly_reviews_updated_at
  before update on public.weekly_reviews
  for each row execute function public.set_updated_at();

-- ============================================
-- Cross-owner link validation
-- ============================================
create or replace function public.validate_cycle_goal_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.focus_cycles c
    where c.id = new.cycle_id and c.owner_id = new.owner_id
  ) then
    raise exception 'cycle_goal_cycle_owner_mismatch';
  end if;

  if not exists (
    select 1 from public.goals g
    where g.id = new.goal_id and g.owner_id = new.owner_id
  ) then
    raise exception 'cycle_goal_goal_owner_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists focus_cycle_goals_validate on public.focus_cycle_goals;
create trigger focus_cycle_goals_validate
  before insert or update on public.focus_cycle_goals
  for each row execute function public.validate_cycle_goal_owner();

create or replace function public.validate_project_goal_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.goal_id is not null and not exists (
    select 1 from public.goals g
    where g.id = new.goal_id and g.owner_id = new.owner_id
  ) then
    raise exception 'project_goal_owner_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_validate_goal on public.projects;
create trigger projects_validate_goal
  before insert or update on public.projects
  for each row execute function public.validate_project_goal_owner();

create or replace function public.validate_milestone_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.owner_id = new.owner_id
  ) then
    raise exception 'milestone_project_owner_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists milestones_validate_project on public.milestones;
create trigger milestones_validate_project
  before insert or update on public.milestones
  for each row execute function public.validate_milestone_project_owner();

-- ============================================
-- Account deletion (AUTH-06)
-- Deletes the auth user; every user-owned table cascades from auth.users.
-- ============================================
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- ============================================
-- Profile timestamps
-- ============================================
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists goals_updated_at on public.goals;
create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

drop trigger if exists life_areas_updated_at on public.life_areas;
create trigger life_areas_updated_at
  before update on public.life_areas
  for each row execute function public.set_updated_at();

-- ============================================
-- Goals: status constraint (GOAL-02)
-- ============================================
alter table public.goals
  drop constraint if exists goals_status_check;
alter table public.goals
  add constraint goals_status_check
  check (status in ('planned', 'active', 'maintenance', 'on_hold', 'completed', 'archived'));

-- ============================================
-- Life areas: status (LIFE-04)
-- ============================================
alter table public.life_areas
  add column if not exists icon text;
