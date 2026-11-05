-- ONE DIRECTION — Hardening (Migration 003)
-- Forward-only migration addressing review findings F-01..F-06.
-- Requires PostgreSQL 15+ (column-list ON DELETE SET NULL).
--
-- Contents:
--   A. Composite (id, owner_id) keys + foreign keys so a child row can never
--      reference another user's row (F-01).
--   B. Cycle-safe, bounded task hierarchy validation (F-03).
--   C. Concurrency-safe top-3 priority limit (F-04).
--   D. Transactional focus-cycle creation / goal replacement, deferred
--      exactly-one-primary and secondary-override invariants (F-02, F-04).
--   E. Atomic focus-session transitions (F-05).
--   F. Atomic onboarding completion (F-06).

-- ============================================
-- A. Ownership integrity for foreign keys (F-01)
-- ============================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'life_areas_id_owner_key') then
    alter table public.life_areas add constraint life_areas_id_owner_key unique (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goals_id_owner_key') then
    alter table public.goals add constraint goals_id_owner_key unique (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_id_owner_key') then
    alter table public.projects add constraint projects_id_owner_key unique (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'milestones_id_owner_key') then
    alter table public.milestones add constraint milestones_id_owner_key unique (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_id_owner_key') then
    alter table public.tasks add constraint tasks_id_owner_key unique (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_cycles_id_owner_key') then
    alter table public.focus_cycles add constraint focus_cycles_id_owner_key unique (id, owner_id);
  end if;
end $$;

-- Parent/child pairs. The owner_id column participates in the reference, so a
-- row owned by user A can never point at user B's row. MATCH SIMPLE keeps
-- nullable links optional; the column list on SET NULL keeps owner_id intact.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'goals_life_area_owner_fk') then
    alter table public.goals
      add constraint goals_life_area_owner_fk
      foreign key (life_area_id, owner_id)
      references public.life_areas (id, owner_id)
      on delete set null (life_area_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'projects_goal_owner_fk') then
    alter table public.projects
      add constraint projects_goal_owner_fk
      foreign key (goal_id, owner_id)
      references public.goals (id, owner_id)
      on delete set null (goal_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'milestones_project_owner_fk') then
    alter table public.milestones
      add constraint milestones_project_owner_fk
      foreign key (project_id, owner_id)
      references public.projects (id, owner_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_goal_owner_fk') then
    alter table public.tasks
      add constraint tasks_goal_owner_fk
      foreign key (goal_id, owner_id)
      references public.goals (id, owner_id)
      on delete set null (goal_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_project_owner_fk') then
    alter table public.tasks
      add constraint tasks_project_owner_fk
      foreign key (project_id, owner_id)
      references public.projects (id, owner_id)
      on delete set null (project_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_milestone_owner_fk') then
    alter table public.tasks
      add constraint tasks_milestone_owner_fk
      foreign key (milestone_id, owner_id)
      references public.milestones (id, owner_id)
      on delete set null (milestone_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_parent_owner_fk') then
    alter table public.tasks
      add constraint tasks_parent_owner_fk
      foreign key (parent_task_id, owner_id)
      references public.tasks (id, owner_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'schedule_blocks_task_owner_fk') then
    alter table public.schedule_blocks
      add constraint schedule_blocks_task_owner_fk
      foreign key (task_id, owner_id)
      references public.tasks (id, owner_id)
      on delete set null (task_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'focus_sessions_task_owner_fk') then
    alter table public.focus_sessions
      add constraint focus_sessions_task_owner_fk
      foreign key (task_id, owner_id)
      references public.tasks (id, owner_id)
      on delete set null (task_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'focus_cycle_goals_cycle_owner_fk') then
    alter table public.focus_cycle_goals
      add constraint focus_cycle_goals_cycle_owner_fk
      foreign key (cycle_id, owner_id)
      references public.focus_cycles (id, owner_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'focus_cycle_goals_goal_owner_fk') then
    alter table public.focus_cycle_goals
      add constraint focus_cycle_goals_goal_owner_fk
      foreign key (goal_id, owner_id)
      references public.goals (id, owner_id)
      on delete cascade;
  end if;
end $$;

-- ============================================
-- B. Cycle-safe, bounded task hierarchy (F-03)
-- ============================================

create or replace function public.validate_task_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent uuid;
  v_depth integer := 0;
  v_visited uuid[] := array[new.id];
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
    if new.parent_task_id = new.id then
      raise exception 'task_self_parent';
    end if;

    v_parent := new.parent_task_id;
    while v_parent is not null loop
      -- Walking the proposed parent chain and seeing this task's own id means
      -- the edit would introduce a cycle (direct or indirect).
      if v_parent = any(v_visited) then
        raise exception 'task_cycle_detected';
      end if;
      v_visited := v_visited || v_parent;
      v_depth := v_depth + 1;
      if v_depth > 2 then
        raise exception 'task_depth_exceeded';
      end if;
      select t.parent_task_id into v_parent from public.tasks t where t.id = v_parent;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_validate_links on public.tasks;
create trigger tasks_validate_links
  before insert or update on public.tasks
  for each row execute function public.validate_task_links();

-- ============================================
-- C. Concurrency-safe top-3 priority limit (F-04)
-- ============================================

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

  -- Serialise concurrent priority writes for the same owner + day. Without
  -- this, two transactions can both observe a count of two and both succeed.
  perform pg_advisory_xact_lock(
    hashtextextended(new.owner_id::text || ':' || new.scheduled_for::text, 0)
  );

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
-- D. Focus-cycle invariants and transactional assignment (F-02)
-- ============================================

alter table public.focus_cycles
  add column if not exists secondary_override boolean not null default false;

-- Exactly one primary goal, at most two secondary goals unless the owner
-- explicitly overrode the limit. Deferred so a transactional replacement can
-- delete and re-insert within one transaction.
create or replace function public.assert_cycle_role_invariants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle uuid;
  v_active boolean;
  v_override boolean;
  v_primary integer;
  v_secondary integer;
begin
  v_cycle := case when tg_op = 'DELETE' then old.cycle_id else new.cycle_id end;

  select active, secondary_override into v_active, v_override
  from public.focus_cycles where id = v_cycle;

  if v_active is not true then
    return null;
  end if;

  select
    count(*) filter (where role = 'primary'),
    count(*) filter (where role = 'secondary')
  into v_primary, v_secondary
  from public.focus_cycle_goals
  where cycle_id = v_cycle;

  if v_primary <> 1 then
    raise exception 'cycle_primary_required';
  end if;

  if v_secondary > 2 and coalesce(v_override, false) is false then
    raise exception 'cycle_secondary_limit';
  end if;

  return null;
end;
$$;

drop trigger if exists focus_cycle_goals_role_invariants on public.focus_cycle_goals;
create constraint trigger focus_cycle_goals_role_invariants
  after insert or update or delete on public.focus_cycle_goals
  deferrable initially deferred
  for each row execute function public.assert_cycle_role_invariants();

create or replace function public.assert_cycle_row_invariants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary integer;
  v_secondary integer;
begin
  if new.active is not true then
    return null;
  end if;

  select
    count(*) filter (where role = 'primary'),
    count(*) filter (where role = 'secondary')
  into v_primary, v_secondary
  from public.focus_cycle_goals
  where cycle_id = new.id;

  if v_primary <> 1 then
    raise exception 'cycle_primary_required';
  end if;

  if v_secondary > 2 and coalesce(new.secondary_override, false) is false then
    raise exception 'cycle_secondary_limit';
  end if;

  return null;
end;
$$;

drop trigger if exists focus_cycles_role_invariants on public.focus_cycles;
create constraint trigger focus_cycles_role_invariants
  after insert or update on public.focus_cycles
  deferrable initially deferred
  for each row execute function public.assert_cycle_row_invariants();

-- Replaces all assignments for a cycle in one transaction. Validates cycle and
-- goal ownership, deduplicates, and enforces the secondary limit + override.
create or replace function public.set_cycle_goal_assignments(
  p_cycle_id uuid,
  p_primary uuid,
  p_secondary uuid[] default '{}',
  p_maintenance uuid[] default '{}',
  p_secondary_override boolean default false
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_secondary uuid[];
  v_maintenance uuid[];
  v_all uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.focus_cycles
    where id = p_cycle_id and owner_id = v_uid and active = true
  ) then
    raise exception 'cycle_not_found';
  end if;

  if p_primary is null then
    raise exception 'primary_required';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_secondary
  from unnest(coalesce(p_secondary, '{}')) as x;
  select coalesce(array_agg(distinct x), '{}') into v_maintenance
  from unnest(coalesce(p_maintenance, '{}')) as x;

  v_all := array[p_primary] || v_secondary || v_maintenance;
  if (select count(distinct x) from unnest(v_all) as x) <> cardinality(v_all) then
    raise exception 'duplicate_goal';
  end if;

  if exists (
    select 1 from unnest(v_all) as x
    where not exists (select 1 from public.goals g where g.id = x and g.owner_id = v_uid)
  ) then
    raise exception 'goal_not_found';
  end if;

  if cardinality(v_secondary) > 2 and p_secondary_override is not true then
    raise exception 'secondary_limit';
  end if;

  update public.focus_cycles
  set secondary_override = (cardinality(v_secondary) > 2 and p_secondary_override is true)
  where id = p_cycle_id and owner_id = v_uid;

  delete from public.focus_cycle_goals
  where cycle_id = p_cycle_id and owner_id = v_uid;

  insert into public.focus_cycle_goals (owner_id, cycle_id, goal_id, role)
  values (v_uid, p_cycle_id, p_primary, 'primary');

  if cardinality(v_secondary) > 0 then
    insert into public.focus_cycle_goals (owner_id, cycle_id, goal_id, role)
    select v_uid, p_cycle_id, x, 'secondary' from unnest(v_secondary) as x;
  end if;

  if cardinality(v_maintenance) > 0 then
    insert into public.focus_cycle_goals (owner_id, cycle_id, goal_id, role)
    select v_uid, p_cycle_id, x, 'maintenance' from unnest(v_maintenance) as x;
  end if;
end;
$$;

create or replace function public.create_focus_cycle(
  p_title text,
  p_start_date date,
  p_duration_weeks integer,
  p_primary uuid,
  p_secondary uuid[] default '{}',
  p_maintenance uuid[] default '{}',
  p_secondary_override boolean default false
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_cycle uuid;
  v_end date;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_start_date is null then
    raise exception 'start_required';
  end if;
  if p_duration_weeks is null or p_duration_weeks < 2 or p_duration_weeks > 6 then
    raise exception 'invalid_duration';
  end if;
  if exists (
    select 1 from public.focus_cycles where owner_id = v_uid and active = true
  ) then
    raise exception 'active_cycle_exists';
  end if;

  v_end := p_start_date + (p_duration_weeks * 7 - 1);

  insert into public.focus_cycles (
    owner_id, title, start_date, end_date, duration_weeks, active, secondary_override
  ) values (
    v_uid, nullif(btrim(coalesce(p_title, '')), ''), p_start_date, v_end, p_duration_weeks, true, false
  ) returning id into v_cycle;

  perform public.set_cycle_goal_assignments(
    v_cycle, p_primary, p_secondary, p_maintenance, p_secondary_override
  );

  return v_cycle;
end;
$$;

-- ============================================
-- E. Atomic focus-session transitions (F-05)
-- ============================================

create or replace function public.pause_focus_session(p_session uuid)
returns public.focus_sessions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.focus_sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.focus_sessions
  set
    accumulated_seconds = accumulated_seconds
      + greatest(0, floor(extract(epoch from (now() - coalesce(resumed_at, started_at)))))::int,
    paused_at = now(),
    status = 'paused'
  where id = p_session
    and owner_id = v_uid
    and ended_at is null
    and status = 'running'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'session_state_conflict';
  end if;

  return v_row;
end;
$$;

create or replace function public.resume_focus_session(p_session uuid)
returns public.focus_sessions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.focus_sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.focus_sessions
  set status = 'running', resumed_at = now(), paused_at = null
  where id = p_session
    and owner_id = v_uid
    and ended_at is null
    and status = 'paused'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'session_state_conflict';
  end if;

  return v_row;
end;
$$;

create or replace function public.end_focus_session(
  p_session uuid,
  p_cancel boolean default false,
  p_notes text default null
) returns public.focus_sessions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.focus_sessions;
  v_actual integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row
  from public.focus_sessions
  where id = p_session and owner_id = v_uid and ended_at is null
  for update;

  if v_row.id is null then
    raise exception 'session_state_conflict';
  end if;

  v_actual := case
    when v_row.status = 'paused' then v_row.accumulated_seconds
    else v_row.accumulated_seconds
      + greatest(0, floor(extract(epoch from (now() - coalesce(v_row.resumed_at, v_row.started_at)))))::int
  end;

  update public.focus_sessions
  set
    actual_seconds = v_actual,
    accumulated_seconds = v_actual,
    ended_at = now(),
    status = case when p_cancel then 'cancelled' else 'completed' end,
    notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes)
  where id = p_session and owner_id = v_uid
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.increment_focus_interruptions(p_session uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.focus_sessions
  set interruptions = interruptions + 1
  where id = p_session and owner_id = v_uid and ended_at is null
  returning interruptions into v_count;

  if v_count is null then
    raise exception 'session_state_conflict';
  end if;

  return v_count;
end;
$$;

-- ============================================
-- F. Atomic onboarding completion (F-06)
-- ============================================

create or replace function public.finish_onboarding(
  p_goal_title text default null,
  p_life_area_id uuid default null,
  p_start_date date default null,
  p_duration_weeks integer default 4
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_goal uuid;
  v_cycle uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_goal_title is not null and btrim(p_goal_title) <> '' then
    insert into public.goals (owner_id, title, life_area_id, status)
    values (v_uid, btrim(p_goal_title), p_life_area_id, 'active')
    returning id into v_goal;

    v_cycle := public.create_focus_cycle(
      null::text,
      coalesce(p_start_date, current_date),
      coalesce(p_duration_weeks, 4),
      v_goal,
      '{}'::uuid[],
      '{}'::uuid[],
      false
    );
  end if;

  update public.profiles
  set onboarding_completed_at = now()
  where id = v_uid;

  return v_cycle;
end;
$$;
