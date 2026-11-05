/**
 * Execute migrations 001-004 against PGlite, a real PostgreSQL engine
 * compiled to WASM, with a minimal Supabase shim (auth.users, auth.uid(),
 * anon/authenticated/service_role, Supabase-style default grants).
 *
 * This is NOT a Supabase project. It proves the SQL parses and runs, the
 * triggers behave, and the privilege matrix is what migration 004 claims.
 * It does not prove PostgREST/GoTrue wiring or RLS under a real JWT.
 *
 * Usage: node scripts/verify-migrations.mjs
 */
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const UID_A = "11111111-1111-4111-8111-111111111111";
const UID_B = "22222222-2222-4222-8222-222222222222";

const db = new PGlite();
let failures = 0;
let checks = 0;

function pass(label, detail = "") {
  checks += 1;
  console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, error) {
  failures += 1;
  console.log(`  FAIL ${label} — ${error?.message ?? error}`);
}

async function check(label, fn) {
  try {
    const detail = await fn();
    pass(label, detail === undefined ? "" : String(detail));
  } catch (error) {
    fail(label, error);
  }
}

async function expectError(label, sql, needle) {
  checks += 1;
  try {
    await db.exec(sql);
  } catch (error) {
    const message = String(error?.message ?? error);
    if (needle && !message.includes(needle)) {
      failures += 1;
      console.log(`  FAIL ${label} — expected "${needle}", got "${message}"`);
      return;
    }
    pass(label, needle);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${label} — statement succeeded but should have failed`);
}

async function one(sql) {
  const result = await db.query(sql);
  return result.rows[0];
}

async function scenario(label, uid, fn) {
  try {
    await asUser(uid, fn);
  } catch (error) {
    fail(label, error);
  }
}

async function asUser(uid, fn) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      `select set_config('request.jwt.claim.sub', '', false); reset role;`
    );
  }
}

async function migration(name) {
  const raw = await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");
  // PGlite does not ship uuid-ossp; the shim above provides
  // uuid_generate_v4() with the same signature and behaviour.
  const sql = raw.replace(
    /create extension if not exists "uuid-ossp";/i,
    "-- uuid-ossp shim installed by the verification harness"
  );
  await db.exec(sql);
}

console.log("Bootstrap: Supabase-shaped roles, auth schema, default grants");
await db.exec(`
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text
  );
  create function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create function public.uuid_generate_v4() returns uuid
    language sql as $$ select gen_random_uuid() $$;

  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase grants these on the auth schema so RLS policies can call
  -- auth.uid() as the querying role.
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

console.log("Apply migrations 001-004 in order");
for (const name of [
  "001_initial_schema.sql",
  "002_core_domains.sql",
  "003_hardening.sql",
  "004_integrity_hardening.sql",
]) {
  await check(`apply ${name}`, async () => {
    await migration(name);
    return "executed";
  });
}

if (failures > 0) {
  console.log("\nMigration execution failed; skipping behaviour checks.");
  process.exit(1);
}

await db.exec(`
  insert into auth.users (id, email) values
    ('${UID_A}', 'a@example.test'),
    ('${UID_B}', 'b@example.test');
`);

console.log("\nF-16 privilege matrix (migration 004)");
await check("authenticated has SELECT on focus_sessions", async () => {
  const row = await one(
    `select has_table_privilege('authenticated','public.focus_sessions','SELECT') as ok`
  );
  if (!row.ok) throw new Error("SELECT missing");
});
await check("authenticated has no INSERT on focus_sessions", async () => {
  const row = await one(
    `select has_table_privilege('authenticated','public.focus_sessions','INSERT') as ok`
  );
  if (row.ok) throw new Error("INSERT still granted");
});
await check("authenticated has no table-level UPDATE on focus_sessions", async () => {
  const row = await one(
    `select has_table_privilege('authenticated','public.focus_sessions','UPDATE') as ok`
  );
  if (row.ok) throw new Error("UPDATE still granted");
});
await check("authenticated has UPDATE(notes) on focus_sessions", async () => {
  const row = await one(
    `select has_column_privilege('authenticated','public.focus_sessions','notes','UPDATE') as ok`
  );
  if (!row.ok) throw new Error("notes column grant missing");
});
await check("anon has no timer table privileges", async () => {
  const row = await one(
    `select has_table_privilege('anon','public.focus_sessions','SELECT') as ok`
  );
  if (row.ok) throw new Error("anon can still read focus_sessions");
});
await check("authenticated may execute start_focus_session", async () => {
  const row = await one(
    `select has_function_privilege('authenticated','public.start_focus_session(uuid,integer)','EXECUTE') as ok`
  );
  if (!row.ok) throw new Error("execute missing");
});
await check("anon may not execute start_focus_session", async () => {
  const row = await one(
    `select has_function_privilege('anon','public.start_focus_session(uuid,integer)','EXECUTE') as ok`
  );
  if (row.ok) throw new Error("anon can still execute the RPC");
});

console.log("\nF-14 helper privilege regression (_assert_cycle_role_invariants)");
await check("anon cannot execute _assert_cycle_role_invariants", async () => {
  const row = await one(
    `select has_function_privilege('anon','public._assert_cycle_role_invariants(uuid)','EXECUTE') as ok`
  );
  if (row.ok) throw new Error("anon inherited PUBLIC EXECUTE on the helper");
});
await check("authenticated cannot execute _assert_cycle_role_invariants", async () => {
  const row = await one(
    `select has_function_privilege('authenticated','public._assert_cycle_role_invariants(uuid)','EXECUTE') as ok`
  );
  if (row.ok) throw new Error("authenticated can execute the helper");
});
await check("PUBLIC EXECUTE on the helper is not inherited by anon", async () => {
  const anon = await one(
    `select has_function_privilege('anon','public._assert_cycle_role_invariants(uuid)','EXECUTE') as ok`
  );
  if (anon.ok) throw new Error("anon still has EXECUTE through PUBLIC inheritance");
  return "anon has no EXECUTE (PUBLIC revoked)";
});


console.log("\nF-14 cycle invariants (source cycle on move, OLD on delete)");
await scenario("F-14 cycle invariants", UID_A, async () => {
  await db.exec(`update public.focus_cycles set active = false where active`);
  const goals = await db.query(`
    insert into public.goals (owner_id, title, status) values
      ('${UID_A}', 'g-cycle-a', 'active'),
      ('${UID_A}', 'g-cycle-b', 'active'),
      ('${UID_A}', 'g-secondary-1', 'active'),
      ('${UID_A}', 'g-secondary-2', 'active'),
      ('${UID_A}', 'g-secondary-3', 'active')
    returning id, title;
  `);
  const byTitle = Object.fromEntries(goals.rows.map((r) => [r.title, r.id]));

  const createdB = await one(
    `select public.create_focus_cycle('cycle B', current_date, 4, '${byTitle["g-cycle-b"]}',
       array['${byTitle["g-secondary-3"]}']::uuid[], array[]::uuid[], false) as id`
  );
  await db.exec(`update public.focus_cycles set active = false where id = '${createdB.id}'`);
  // Cycle B stays inactive. Remove its primary so that moving cycle A's
  // primary into cycle B doesn't trip the one-primary unique index before
  // the source-cycle invariant is evaluated. Keep cycle B's secondary so
  // the secondary-limit test can move it into cycle A.
  await db.exec(
    `delete from public.focus_cycle_goals where cycle_id = '${createdB.id}' and role = 'primary'`
  );
  // Cycle A (active) already holds two secondaries, so moving cycle B's
  // secondary into cycle A must be rejected by the secondary limit.
  const createdA = await one(
    `select public.create_focus_cycle('cycle A', current_date, 4, '${byTitle["g-cycle-a"]}',
       array['${byTitle["g-secondary-1"]}','${byTitle["g-secondary-2"]}']::uuid[], array[]::uuid[], false) as id`
  );

  await expectError(
    "moving the only primary out of an active cycle is rejected",
    `update public.focus_cycle_goals set cycle_id = '${createdB.id}'
      where cycle_id = '${createdA.id}' and role = 'primary'`,
    "cycle_primary_required"
  );

  await expectError(
    "deleting the only primary of an active cycle is rejected (OLD.cycle_id)",
    `delete from public.focus_cycle_goals
      where cycle_id = '${createdA.id}' and role = 'primary'`,
    "cycle_primary_required"
  );

  await expectError(
    "moving a secondary into a cycle that would exceed the limit is rejected",
    `update public.focus_cycle_goals set cycle_id = '${createdA.id}'
      where cycle_id = '${createdB.id}' and role = 'secondary'`,
    "cycle_secondary_limit"
  );

  const remaining = await one(
    `select count(*)::int as n from public.focus_cycle_goals
      where cycle_id = '${createdA.id}' and role = 'primary'`
  );
  await check("source cycle still has exactly one primary", async () => {
    if (remaining.n !== 1) throw new Error(`found ${remaining.n}`);
    return "1";
  });
});

console.log("\nF-15 hierarchy serialisation, cycles and subtree depth");
await scenario("F-15 hierarchy", UID_A, async () => {
  const tasks = await db.query(`
    insert into public.tasks (owner_id, title, status) values
      ('${UID_A}', 'root-D', 'todo'),
      ('${UID_A}', 'sub-A', 'todo'),
      ('${UID_A}', 'sub-B', 'todo'),
      ('${UID_A}', 'sub-C', 'todo')
    returning id, title;
  `);
  const t = Object.fromEntries(tasks.rows.map((r) => [r.title, r.id]));

  // sub-A is a root with a two-level subtree: B is its child, C is B's.
  await db.exec(`update public.tasks set parent_task_id = '${t["sub-A"]}' where id = '${t["sub-B"]}'`);
  await db.exec(`update public.tasks set parent_task_id = '${t["sub-B"]}' where id = '${t["sub-C"]}'`);
  pass("built a legal subtree (depth 0-1-2)");

  await expectError(
    "re-parenting a subtree that would exceed depth 2 is rejected",
    `update public.tasks set parent_task_id = '${t["root-D"]}' where id = '${t["sub-A"]}'`,
    "task_depth_exceeded"
  );

  await check("rejected move left subtree root parent unchanged (NULL)", async () => {
    const row = await one(
      `select parent_task_id from public.tasks where id = '${t["sub-A"]}'`
    );
    if (row.parent_task_id !== null)
      throw new Error(`parent changed to ${row.parent_task_id}; must stay NULL`);
    return "parent still NULL";
  });

  await expectError(
    "three-node cycle is rejected",
    `update public.tasks set parent_task_id = '${t["sub-C"]}' where id = '${t["sub-A"]}'`,
    "task_cycle_detected"
  );
});

console.log("\nF-16 timer creation and transitions");
await scenario("F-16 timer", UID_A, async () => {
  const task = await one(`
    insert into public.tasks (owner_id, title, status)
    values ('${UID_A}', 'timer-task', 'todo') returning id
  `);

  await expectError(
    "direct insert into focus_sessions is denied",
    `insert into public.focus_sessions (owner_id, task_id, planned_seconds)
     values ('${UID_A}', '${task.id}', 1500)`,
    "permission denied"
  );

  const started = await one(
    `select * from public.start_focus_session('${task.id}', 1500)`
  );
  await check("start_focus_session creates a running session", async () => {
    if (started.status !== "running") throw new Error(`status ${started.status}`);
    if (started.actual_seconds !== null) throw new Error("actual_seconds prefilled");
    if (started.accumulated_seconds !== 0) throw new Error("accumulated prefilled");
    return started.status;
  });

  await expectError(
    "a second concurrent-style start is rejected",
    `select public.start_focus_session('${task.id}', 1500)`,
    "session_already_active"
  );

  await expectError(
    "direct status mutation is denied",
    `update public.focus_sessions set status = 'completed' where id = '${started.id}'`,
    "permission denied"
  );
  await expectError(
    "direct ended_at mutation is denied",
    `update public.focus_sessions set ended_at = now() where id = '${started.id}'`,
    "permission denied"
  );
  await expectError(
    "direct actual_seconds mutation is denied",
    `update public.focus_sessions set actual_seconds = 9999 where id = '${started.id}'`,
    "permission denied"
  );

  await check("notes remain editable through the column grant", async () => {
    await db.exec(`update public.focus_sessions set notes = 'note' where id = '${started.id}'`);
  });

  await check("pause -> resume -> pause cycle works", async () => {
    const paused = await one(`select * from public.pause_focus_session('${started.id}')`);
    if (paused.status !== "paused") throw new Error(`status ${paused.status}`);
    const resumed = await one(`select * from public.resume_focus_session('${started.id}')`);
    if (resumed.status !== "running") throw new Error(`status ${resumed.status}`);
    return "paused then running";
  });

  await expectError(
    "replaying resume on a running session conflicts",
    `select public.resume_focus_session('${started.id}')`,
    "session_state_conflict"
  );

  await check("end_focus_session completes with a server duration", async () => {
    const ended = await one(`select * from public.end_focus_session('${started.id}')`);
    if (ended.status !== "completed") throw new Error(`status ${ended.status}`);
    if (ended.actual_seconds === null) throw new Error("actual_seconds not stamped");
    return `actual_seconds=${ended.actual_seconds}`;
  });

  await expectError(
    "replaying end_focus_session conflicts",
    `select public.end_focus_session('${started.id}')`,
    "session_state_conflict"
  );
});

console.log("\nCross-owner isolation");
await scenario("cross-owner isolation", UID_B, async () => {
  const row = await one(`select count(*)::int as n from public.focus_sessions`);
  await check("user B cannot see user A's sessions through RLS", async () => {
    if (row.n !== 0) throw new Error(`saw ${row.n} rows`);
    return "0 rows";
  });

  await expectError(
    "user B cannot start a session on user A's task",
    `select public.start_focus_session(
       (select id from public.tasks where title = 'timer-task' limit 1), 1500)`,
    "task_not_found_or_forbidden"
  );
});

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
console.log("All migration and behaviour checks passed against PGlite (PostgreSQL/WASM).");
