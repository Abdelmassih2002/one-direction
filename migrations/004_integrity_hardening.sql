-- ============================================================
-- ONE DIRECTION — Integrity hardening (Migration 004)
-- Applied on top of 001/002/003, forward-only.
--
-- Addresses review findings F-14, F-15, F-16 and the follow-up
-- corrections CR-01..CR-06, CR-10.
--
--   A. F-14  exactly one primary / secondary limit on an active
--            cycle, validated for every cycle a statement touches
--            (source AND destination, and OLD on DELETE).
--   B. F-15  per-owner serialisation of parent-chain edits, plus
--            depth re-validation of the whole subtree on a move.
--   C. F-16  timer state is only mutable through the transition
--            functions, for the real Supabase role `authenticated`.
--   D. start_focus_session(): the only session-creation path.
--
-- RLS policies are NOT modified here. This migration only narrows
-- table/function privileges and adds server-side validation, so no
-- existing policy is weakened.
-- ============================================================


-- ------------------------------------------------------------
-- A. F-14 — cycle role invariants
--
-- The pre-004 trigger validated only the cycle named by NEW, so
-- moving (or deleting) a primary assignment out of an active cycle
-- left that source cycle with zero primary goals. Every affected
-- cycle is now validated, and DELETE reads OLD: NEW is unpopulated
-- in a DELETE trigger.
-- ------------------------------------------------------------

create or replace function public._assert_cycle_role_invariants(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active boolean;
  v_override boolean;
  v_primary integer;
  v_secondary integer;
begin
  if p_cycle_id is null then
    return;
  end if;

  select c.active, c.secondary_override
    into v_active, v_override
  from public.focus_cycles c
  where c.id = p_cycle_id;

  -- A cycle that no longer exists (cascade delete) has nothing to assert.
  if v_active is not true then
    return;
  end if;

  select
    count(*) filter (where g.role = 'primary'),
    count(*) filter (where g.role = 'secondary')
  into v_primary, v_secondary
  from public.focus_cycle_goals g
  where g.cycle_id = p_cycle_id;

  if v_primary <> 1 then
    raise exception 'cycle_primary_required'
      using detail = format('cycle %s has %s primary goals', p_cycle_id, v_primary);
  end if;

  if v_secondary > 2 and coalesce(v_override, false) is false then
    raise exception 'cycle_secondary_limit'
      using detail = format('cycle %s has %s secondary goals', p_cycle_id, v_secondary);
  end if;
end;
$$;

create or replace function public.assert_cycle_role_invariants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- NEW is unpopulated on DELETE; the affected cycle is OLD.cycle_id.
    perform public._assert_cycle_role_invariants(old.cycle_id);
    return null;
  end if;

  if tg_op = 'UPDATE' then
    -- The source cycle loses a row and the destination cycle gains one.
    perform public._assert_cycle_role_invariants(old.cycle_id);
    if old.cycle_id is distinct from new.cycle_id then
      perform public._assert_cycle_role_invariants(new.cycle_id);
    end if;
    return null;
  end if;

  perform public._assert_cycle_role_invariants(new.cycle_id);
  return null;
end;
$$;

drop trigger if exists focus_cycle_goals_role_invariants
  on public.focus_cycle_goals;
create constraint trigger focus_cycle_goals_role_invariants
  after insert or update or delete on public.focus_cycle_goals
  deferrable initially deferred
  for each row execute function public.assert_cycle_role_invariants();

-- _assert_cycle_role_invariants is a SECURITY DEFINER helper. It must not be
-- callable by PUBLIC or anon; only the trigger (and trusted server paths)
-- should invoke it. PUBLIC loses the default EXECUTE; anon is revoked
-- explicitly because Supabase grants EXECUTE on new functions to anon too.
do $$
begin
  revoke execute on function public._assert_cycle_role_invariants(uuid) from public;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    revoke execute on function public._assert_cycle_role_invariants(uuid) from anon;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    revoke execute on function public._assert_cycle_role_invariants(uuid) from authenticated;
  end if;
end;
$$;


-- ------------------------------------------------------------
-- B. F-15 — serialised hierarchy edits + subtree depth
--
-- Two concurrent transactions could each validate against a
-- snapshot that does not contain the other's uncommitted edge and
-- together create a cycle. A per-owner transaction advisory lock
-- serialises parent-chain edits for that owner.
--
-- hashtextextended(text, bigint): the seed is a bigint, and a uuid
-- cannot be cast to integer. The owner id is folded into the
-- hashed text instead.
-- ------------------------------------------------------------

create or replace function public.validate_task_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent uuid;
  v_depth integer := 0;
  v_visited uuid[] := array[new.id];
  v_height integer := 0;
begin
  if new.goal_id is not null then
    if not exists (
      select 1 from public.goals g
      where g.id = new.goal_id and g.owner_id = new.owner_id
    ) then
      raise exception 'task_goal_owner_mismatch';
    end if;
  end if;

  if new.project_id is not null then
    if not exists (
      select 1 from public.projects p
      where p.id = new.project_id and p.owner_id = new.owner_id
    ) then
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

  if new.parent_task_id is null then
    return new;
  end if;

  if new.parent_task_id = new.id then
    raise exception 'task_self_parent';
  end if;

  if new.owner_id is null then
    raise exception 'task_owner_id_missing';
  end if;

  -- One lock per owner serialises every parent-chain mutation for
  -- that owner across concurrent transactions. A task tree is small
  -- and personal, so per-owner contention is acceptable and keeps
  -- lock ordering trivial (no deadlocks between unrelated keys).
  perform pg_advisory_xact_lock(
    hashtextextended('tasks_hierarchy:' || new.owner_id::text, 0)
  );

  -- Walk the proposed ancestor chain from committed rows. The row
  -- being written is visible in this snapshot, so seeing our own id
  -- means the edit closes a cycle.
  v_parent := new.parent_task_id;
  while v_parent is not null loop
    if v_parent = any(v_visited) then
      raise exception 'task_cycle_detected';
    end if;
    v_visited := v_visited || v_parent;
    v_depth := v_depth + 1;
    if v_depth > 2 then
      raise exception 'task_depth_exceeded';
    end if;
    select t.parent_task_id into v_parent
      from public.tasks t
     where t.id = v_parent;
  end loop;

  -- v_depth is now the depth of NEW (its ancestor count). Moving an
  -- existing task also moves every descendant, so a subtree that was
  -- legal at the old position can become illegal at the new one. The
  -- upward walk alone cannot see that; measure the subtree height.
  if tg_op = 'UPDATE'
     and old.parent_task_id is distinct from new.parent_task_id then
    with recursive subtree as (
      select t.id, 1 as height
        from public.tasks t
       where t.parent_task_id = new.id
      union all
      select c.id, s.height + 1
        from public.tasks c
        join subtree s on c.parent_task_id = s.id
       where s.height < 10
    )
    select coalesce(max(s.height), 0) into v_height
      from subtree s;

    if v_depth + v_height > 2 then
      raise exception 'task_depth_exceeded';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_validate_links on public.tasks;
create trigger tasks_validate_links
  before insert or update on public.tasks
  for each row execute function public.validate_task_links();


-- ------------------------------------------------------------
-- C. F-16 — timer state behind the transition functions
--
-- Supabase authenticates signed-in app users as the built-in
-- `authenticated` role. No custom role is introduced here, and no
-- service-role credential is used anywhere in the app.
--
-- Supabase's default privileges normally give `authenticated` ALL
-- on new public tables. That would let a bearer UPDATE status,
-- ended_at or accumulated_seconds straight through PostgREST and
-- fake timer history without ever calling pause/resume/end. Strip
-- the table privileges and re-grant the minimum: read, plus the
-- notes column (the one user-editable field).
-- ------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    revoke all on table public.focus_sessions from authenticated;
    grant select on table public.focus_sessions to authenticated;
    grant update (notes) on table public.focus_sessions to authenticated;
  end if;

  -- Signed-out visitors never need the timer table directly.
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    revoke all on table public.focus_sessions from anon;
  end if;
end;
$$;

-- Defence in depth for privileged paths (service_role, SQL console,
-- future code): a session row may only be born as a running session
-- with no terminal values. RLS policies are untouched; this is a
-- BEFORE INSERT guard, not a policy replacement.
create or replace function public.guard_focus_session_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from 'running' then
    raise exception 'focus_sessions_insert_terminal_state'
      using detail = 'sessions must start in status running';
  end if;

  -- started_at must be present on a new session so every session carries a
  -- server-clock origin. start_focus_session() stamps it; no client path may
  -- fabricate or omit it.
  if new.started_at is null then
    raise exception 'focus_sessions_insert_terminal_state'
      using detail = 'new sessions must carry a started_at timestamp';
  end if;

  -- started_at must not be in the future relative to the server clock (within
  -- a small tolerance for clock skew between the caller and the database).
  if new.started_at > now() + interval '5 minutes' then
    raise exception 'focus_sessions_insert_terminal_state'
      using detail = 'started_at cannot be in the future';
  end if;

  if new.ended_at is not null then
    raise exception 'focus_sessions_insert_terminal_state'
      using detail = 'new sessions cannot carry ended_at';
  end if;

  if new.paused_at is not null or new.resumed_at is not null then
    raise exception 'focus_sessions_insert_terminal_state'
      using detail = 'new sessions cannot carry pause/resume timestamps';
  end if;

  if coalesce(new.actual_seconds, 0) <> 0 then
    raise exception 'focus_sessions_insert_terminal_state'
      using detail = 'new sessions cannot ship a fabricated actual_seconds';
  end if;

  if new.accumulated_seconds <> 0 then
    raise exception 'focus_sessions_insert_terminal_state'
      using detail = 'new sessions cannot ship a fabricated accumulated_seconds';
  end if;

  if new.interruptions <> 0 then
    raise exception 'focus_sessions_insert_terminal_state'
      using detail = 'new sessions cannot ship a fabricated interruption count';
  end if;

  return new;
end;
$$;

drop trigger if exists focus_sessions_insert_guard on public.focus_sessions;
create trigger focus_sessions_insert_guard
  before insert on public.focus_sessions
  for each row execute function public.guard_focus_session_insert();


-- ------------------------------------------------------------
-- D. start_focus_session — the only creation path
--
-- The old action inserted straight into the table with a
-- client-computed started_at/status. Creation now happens inside a
-- SECURITY DEFINER function that derives the owner from auth.uid(),
-- checks task ownership and the one-open-session rule, and stamps
-- started_at with the server clock.
-- ------------------------------------------------------------

create or replace function public.start_focus_session(
  p_task_id uuid,
  p_planned_seconds integer
) returns public.focus_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.focus_sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_task_id is null then
    raise exception 'task_not_found_or_forbidden';
  end if;

  if p_planned_seconds is null
     or p_planned_seconds <= 0
     or p_planned_seconds > 86400 then
    raise exception 'invalid_planned_seconds';
  end if;

  if not exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.owner_id = v_uid
  ) then
    raise exception 'task_not_found_or_forbidden';
  end if;

  if exists (
    select 1 from public.focus_sessions s
    where s.owner_id = v_uid and s.ended_at is null
  ) then
    raise exception 'session_already_active';
  end if;

  insert into public.focus_sessions (
    owner_id,
    task_id,
    planned_seconds,
    started_at,
    status,
    accumulated_seconds
  ) values (
    v_uid,
    p_task_id,
    p_planned_seconds,
    now(),
    'running',
    0
  )
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    -- Two concurrent starts: the one-open-session index wins the race,
    -- and both callers see the same domain error.
    raise exception 'session_already_active';
end;
$$;

-- Transitions run as definer because `authenticated` no longer holds
-- UPDATE on the timer columns. Identity still comes only from
-- auth.uid(), and the WHERE clauses keep every statement owner-scoped
-- and state-conditional.
create or replace function public.pause_focus_session(p_session uuid)
returns public.focus_sessions
language plpgsql
security definer
set search_path = ''
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
security definer
set search_path = ''
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
security definer
set search_path = ''
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
security definer
set search_path = ''
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

-- Execute is granted only to the role Supabase issues to signed-in
-- users (plus service_role implicitly through its own grants). PUBLIC
-- loses the default EXECUTE so anon cannot call the timer functions.
do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    grant execute on function public.start_focus_session(uuid, integer) to authenticated;
    grant execute on function public.pause_focus_session(uuid) to authenticated;
    grant execute on function public.resume_focus_session(uuid) to authenticated;
    grant execute on function public.end_focus_session(uuid, boolean, text) to authenticated;
    grant execute on function public.increment_focus_interruptions(uuid) to authenticated;
  end if;
end;
$$;

revoke execute on function public.start_focus_session(uuid, integer) from public;
revoke execute on function public.pause_focus_session(uuid) from public;
revoke execute on function public.resume_focus_session(uuid) from public;
revoke execute on function public.end_focus_session(uuid, boolean, text) from public;
revoke execute on function public.increment_focus_interruptions(uuid) from public;

-- Supabase's default privileges also grant EXECUTE on new functions to
-- `anon` directly, so revoking from PUBLIC alone is not enough: an
-- explicit anon grant would survive. Remove it explicitly.
do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    revoke execute on function public.start_focus_session(uuid, integer) from anon;
    revoke execute on function public.pause_focus_session(uuid) from anon;
    revoke execute on function public.resume_focus_session(uuid) from anon;
    revoke execute on function public.end_focus_session(uuid, boolean, text) from anon;
    revoke execute on function public.increment_focus_interruptions(uuid) from anon;
  end if;
end;
$$;

-- Remove objects from earlier drafts of this migration. Neither was
-- ever applied to a real project; the drops keep a partial draft from
-- leaving a second, unguarded creation path behind.
drop function if exists public.create_focus_session(uuid, integer);
drop function if exists public.security_invoker_auditor();
