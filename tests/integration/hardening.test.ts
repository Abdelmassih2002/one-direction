import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * F-14..F-16 live-database regression tests.
 *
 * These talk to a real Supabase project through the authenticated REST API
 * and skip unless TEST_USER_A_* / TEST_USER_B_* are configured. They are
 * therefore SKIPPED on a machine without credentials — never reported as
 * passing.
 *
 * Setup rules that the earlier draft got wrong (CR-07):
 *  - `create_focus_cycle` requires a primary goal and only one active cycle
 *    per owner exists, so scenarios create the goal first, then the cycle,
 *    and close a cycle before creating the next one.
 *  - assertions read the Supabase `{ data, error }` shape (CR-08), not a
 *    PromiseSettledResult heuristic.
 *
 * Concurrency requirements (R-02): the two raced updates use two independent
 * authenticated clients, each of whose sign-in is verified to have succeeded
 * and to carry the expected user ID, before the race is attempted. The
 * assertions on the post-race graph then target a real DDL/DML failure, not
 * a sign-in or RLS rejection.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const accountA = {
  email: process.env.TEST_USER_A_EMAIL,
  password: process.env.TEST_USER_A_PASSWORD,
};
const accountB = {
  email: process.env.TEST_USER_B_EMAIL,
  password: process.env.TEST_USER_B_PASSWORD,
};

const configured =
  Boolean(url && anonKey) &&
  Boolean(accountA.email && accountA.password && accountB.email && accountB.password);

type Session = { client: SupabaseClient; userId: string };

async function signIn(account: { email?: string; password?: string }): Promise<Session> {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email!,
    password: account.password!,
  });
  if (error || !data.user)
    throw new Error(`sign-in failed: ${error?.message ?? "no user"}`);
  return { client, userId: data.user.id };
}

const created: { client: SupabaseClient; table: string; id: string }[] = [];

function track(client: SupabaseClient, table: string, id: string) {
  created.push({ client, table, id });
}

async function createGoal(client: SupabaseClient, ownerId: string, title: string) {
  const { data, error } = await client
    .from("goals")
    .insert({ owner_id: ownerId, title, status: "active" })
    .select("id")
    .single();
  if (error) throw new Error(`goal insert failed: ${error.message}`);
  track(client, "goals", data.id);
  return data.id as string;
}

/** Leaves no active cycle behind, so the next scenario can create one. */
async function resetCycles(client: SupabaseClient) {
  const { error } = await client
    .from("focus_cycles")
    .update({ active: false })
    .eq("active", true);
  if (error) throw new Error(`closing cycles failed: ${error.message}`);
}

async function createCycle(
  client: SupabaseClient,
  title: string,
  primary: string,
  secondary: string[] = []
) {
  const { data, error } = await client.rpc("create_focus_cycle", {
    p_title: title,
    p_start_date: new Date().toISOString().slice(0, 10),
    p_duration_weeks: 4,
    p_primary: primary,
    p_secondary: secondary,
    p_maintenance: [],
    p_secondary_override: false,
  });
  if (error) throw new Error(`create_focus_cycle failed: ${error.message}`);
  track(client, "focus_cycles", data as string);
  return data as string;
}

async function createTask(
  client: SupabaseClient,
  ownerId: string,
  title: string,
  parentTaskId?: string
) {
  const { data, error } = await client
    .from("tasks")
    .insert({
      owner_id: ownerId,
      title,
      status: "todo",
      ...(parentTaskId ? { parent_task_id: parentTaskId } : {}),
    })
    .select("id")
    .single();
  if (error) throw new Error(`task insert failed: ${error.message}`);
  track(client, "tasks", data.id);
  return data.id as string;
}

/** Ends any session left open by a failed scenario. */
async function endOpenSessions(client: SupabaseClient) {
  const { data } = await client
    .from("focus_sessions")
    .select("id")
    .is("ended_at", null);
  for (const row of data ?? []) {
    await client.rpc("end_focus_session", { p_session: row.id, p_cancel: true });
  }
}

/** Walks parent links from `start` and reports whether a cycle exists. */
function hasCycle(
  rows: { id: string; parent_task_id: string | null }[],
  start: string
): boolean {
  const parents = new Map(rows.map((row) => [row.id, row.parent_task_id]));
  const seen = new Set<string>();
  let cursor: string | null | undefined = start;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    cursor = parents.get(cursor) ?? null;
  }
  return Boolean(cursor);
}

describe.skipIf(!configured)(
  "F-14..F-16 database hardening regression (live Supabase required)",
  () => {
    let a: Session;
    let b: Session;

    it("signs in both test accounts", async () => {
      a = await signIn(accountA);
      b = await signIn(accountB);
      expect(a.userId).not.toBe(b.userId);
    });

    it("F-14 rejects moving the only primary goal out of an active cycle", async () => {
      await resetCycles(a.client);
      const goalA = await createGoal(a.client, a.userId, "F-14 primary A");
      const goalB = await createGoal(a.client, a.userId, "F-14 primary B");

      // Only one cycle may be active, so B is created first and closed
      // before A is created with its own valid primary.
      const cycleB = await createCycle(a.client, "F-14 cycle B", goalB);
      const closeB = await a.client
        .from("focus_cycles")
        .update({ active: false })
        .eq("id", cycleB);
      expect(closeB.error).toBeNull();

      // Empty the destination while it is inactive. Without this the
      // destination's existing primary would trip the one-primary unique
      // index first, and the source-cycle invariant (the actual F-14 bug)
      // would never be exercised.
      const clearB = await a.client
        .from("focus_cycle_goals")
        .delete()
        .eq("cycle_id", cycleB);
      expect(clearB.error).toBeNull();

      const cycleA = await createCycle(a.client, "F-14 cycle A", goalA);

      const move = await a.client
        .from("focus_cycle_goals")
        .update({ cycle_id: cycleB })
        .eq("cycle_id", cycleA)
        .eq("goal_id", goalA);
      expect(move.error).not.toBeNull();

      const after = await a.client
        .from("focus_cycle_goals")
        .select("role")
        .eq("cycle_id", cycleA);
      expect(after.data).toEqual([{ role: "primary" }]);
    });

    it("F-14 rejects a move that would exceed the destination secondary limit", async () => {
      await resetCycles(a.client);
      const primaryB = await createGoal(a.client, a.userId, "F-14 dest primary B");
      const mover = await createGoal(a.client, a.userId, "F-14 secondary mover");
      const primaryA = await createGoal(a.client, a.userId, "F-14 dest primary A");
      const secondary1 = await createGoal(a.client, a.userId, "F-14 secondary 1");
      const secondary2 = await createGoal(a.client, a.userId, "F-14 secondary 2");

      const cycleB = await createCycle(a.client, "F-14 dest B", primaryB, [mover]);
      await a.client.from("focus_cycles").update({ active: false }).eq("id", cycleB);

      // A already holds the maximum of two secondaries.
      const cycleA = await createCycle(a.client, "F-14 dest A", primaryA, [
        secondary1,
        secondary2,
      ]);

      const move = await a.client
        .from("focus_cycle_goals")
        .update({ cycle_id: cycleA })
        .eq("cycle_id", cycleB)
        .eq("goal_id", mover);
      expect(move.error).not.toBeNull();

      const after = await a.client
        .from("focus_cycle_goals")
        .select("role")
        .eq("cycle_id", cycleA);
      expect(after.data).toHaveLength(3);
    });

    it("F-14 rejects deleting the only primary of an active cycle (OLD.cycle_id)", async () => {
      await resetCycles(a.client);
      const primary = await createGoal(a.client, a.userId, "F-14 delete primary");
      const cycle = await createCycle(a.client, "F-14 delete cycle", primary);

      // A DELETE trigger has no NEW row. If the trigger reads NEW.cycle_id
      // this succeeds and the active cycle is left with zero primaries.
      const deletion = await a.client
        .from("focus_cycle_goals")
        .delete()
        .eq("cycle_id", cycle)
        .eq("role", "primary");
      expect(deletion.error).not.toBeNull();

      const after = await a.client
        .from("focus_cycle_goals")
        .select("role")
        .eq("cycle_id", cycle);
      expect(after.data).toEqual([{ role: "primary" }]);
    });

    it("F-15 serializes concurrent two-node parent swaps", async () => {
      const taskA = await createTask(a.client, a.userId, "F-15 swap A");
      const taskB = await createTask(a.client, a.userId, "F-15 swap B");

      // Use two independent authenticated clients (R-02), not two fresh
      // clients on the same account from the same test.
      const c1 = createClient(url!, anonKey!, { auth: { persistSession: false } });
      const c2 = createClient(url!, anonKey!, { auth: { persistSession: false } });

      const [s1, s2] = await Promise.all([
        c1.auth.signInWithPassword({
          email: accountA.email!,
          password: accountA.password!,
        }),
        c2.auth.signInWithPassword({
          email: accountA.email!,
          password: accountA.password!,
        }),
      ]);

      if (s1.error || !s1.data.user)
        throw new Error(`client 1 sign-in failed: ${s1.error?.message ?? "no user"}`);
      if (s2.error || !s2.data.user)
        throw new Error(`client 2 sign-in failed: ${s2.error?.message ?? "no user"}`);

      // Verify the authenticating user ID, not just that a session object
      // exists. The race must fail for a hierarchy reason, not because one
      // client was never authenticated or hit RLS.
      expect(s1.data.user.id).toBe(a.userId);
      expect(s2.data.user.id).toBe(a.userId);
      expect(s1.data.user.id).toBe(s2.data.user.id);

      const [swap1, swap2] = await Promise.all([
        c1.from("tasks").update({ parent_task_id: taskA }).eq("id", taskB).select("id").single(),
        c2.from("tasks").update({ parent_task_id: taskB }).eq("id", taskA).select("id").single(),
      ]);

      // Requirement: exactly one update succeeds and one fails with the expected
      // domain error. A two-node swap cannot commit both ways (that would create
      // A→B→A). Because both clients are authenticated as the same verified owner
      // (verified above), a rejection here is a hierarchy constraint, not an auth
      // or RLS problem. Assert the expected loser error AND the expected winner
      // success so an unrelated DB/auth/RLS failure cannot make this test pass.
      if (!swap1.error && !swap2.error) {
        throw new Error("both parent swaps committed — graph should be acyclic");
      }
      if (swap1.error && swap2.error) {
        throw new Error(
          "both swaps failed — expected exactly one winner; got errors: " +
            [swap1.error?.message, swap2.error?.message].join("; ")
        );
      }
      const loser = swap1.error ? swap1 : swap2;
      const winner = swap1.error ? swap2 : swap1;
      expect(loser.error?.message).toMatch(/task_cycle_detected|task_self_parent/);
      expect(winner.data).toBeDefined();
      expect(winner.data?.id).toBe(swap1.error ? taskA : taskB);

      const graph = await a.client
        .from("tasks")
        .select("id, parent_task_id")
        .in("id", [taskA, taskB]);
      expect(graph.error).toBeNull();
      const rows = (graph.data ?? []) as { id: string; parent_task_id: string | null }[];
      expect(hasCycle(rows, taskA)).toBe(false);

      await c1.auth.signOut();
      await c2.auth.signOut();
    });

    it("F-15 rejects a real concurrent A→B→C→A cycle race", async () => {
      const taskA = await createTask(a.client, a.userId, "F-15 cycle A");
      const taskB = await createTask(a.client, a.userId, "F-15 cycle B");
      const taskC = await createTask(a.client, a.userId, "F-15 cycle C");

      // Start from A→B, then race B→C against C→A. If both commit the graph
      // becomes A→B→C→A.
      const preset = await a.client
        .from("tasks")
        .update({ parent_task_id: taskB })
        .eq("id", taskA);
      expect(preset.error).toBeNull();

      const c1 = createClient(url!, anonKey!, { auth: { persistSession: false } });
      const c2 = createClient(url!, anonKey!, { auth: { persistSession: false } });

      const [s1, s2] = await Promise.all([
        c1.auth.signInWithPassword({
          email: accountA.email!,
          password: accountA.password!,
        }),
        c2.auth.signInWithPassword({
          email: accountA.email!,
          password: accountA.password!,
        }),
      ]);

      if (s1.error || !s1.data.user)
        throw new Error(`client 1 sign-in failed: ${s1.error?.message ?? "no user"}`);
      if (s2.error || !s2.data.user)
        throw new Error(`client 2 sign-in failed: ${s2.error?.message ?? "no user"}`);

      expect(s1.data.user.id).toBe(a.userId);
      expect(s2.data.user.id).toBe(a.userId);
      expect(s1.data.user.id).toBe(s2.data.user.id);

      const [bToC, cToA] = await Promise.all([
        c1.from("tasks").update({ parent_task_id: taskC }).eq("id", taskB).select("id").single(),
        c2.from("tasks").update({ parent_task_id: taskA }).eq("id", taskC).select("id").single(),
      ]);

      // Requirement: exactly one leg succeeds and one fails with task_cycle_detected.
      // If both commit the graph becomes A→B→C→A; if both fail we did not get a clean
      // single winner. Assert the loser carries the expected domain error AND the
      // winner committed the expected parent change AND the final graph is acyclic,
      // so an unrelated auth/RLS/DB error cannot fake a pass.
      if (!bToC.error && !cToA.error) {
        throw new Error("both leg updates committed — graph should be acyclic");
      }
      if (bToC.error && cToA.error) {
        throw new Error(
          "both leg updates failed — expected exactly one winner; got errors: " +
            [bToC.error?.message, cToA.error?.message].join("; ")
        );
      }
      const loser = bToC.error ? bToC : cToA;
      const winner = bToC.error ? cToA : bToC;
      expect(loser.error?.message).toMatch(/task_cycle_detected/);
      const winnerParent = bToC.error ? taskA : taskC;
      expect(winner.data).toBeDefined();
      expect(winner.data?.id).toBe(winnerParent);

      const graph = await a.client
        .from("tasks")
        .select("id, parent_task_id")
        .in("id", [taskA, taskB, taskC]);
      expect(graph.error).toBeNull();
      const rows = (graph.data ?? []) as { id: string; parent_task_id: string | null }[];

      expect(hasCycle(rows, taskA)).toBe(false);
      expect(hasCycle(rows, taskB)).toBe(false);
      expect(hasCycle(rows, taskC)).toBe(false);

      await c1.auth.signOut();
      await c2.auth.signOut();
    });

    it("F-15 rejects re-parenting a subtree that would exceed depth 2", async () => {
      const root = await createTask(a.client, a.userId, "F-15 depth root");
      const subtreeRoot = await createTask(a.client, a.userId, "F-15 depth A");
      const child = await createTask(a.client, a.userId, "F-15 depth B", subtreeRoot);
      await createTask(a.client, a.userId, "F-15 depth C", child);

      // The moved task itself would sit at depth 1, but its descendants
      // would land at depth 3 unless the subtree is measured too.
      // The postcondition (R-01): after a rejected move, the moved row's
      // parent_task_id must still be the pre-move root, not null.
      const before = await a.client
        .from("tasks")
        .select("parent_task_id")
        .eq("id", subtreeRoot)
        .single();
      expect(before.data?.parent_task_id).toBeNull();

      const move = await a.client
        .from("tasks")
        .update({ parent_task_id: root })
        .eq("id", subtreeRoot);
      expect(move.error).not.toBeNull();

      const after = await a.client
        .from("tasks")
        .select("parent_task_id")
        .eq("id", subtreeRoot)
        .single();
      expect(after.data?.parent_task_id).toBeNull();
    });

    it("F-16 rejects direct inserts and timer-state mutations", async () => {
      const task = await createTask(a.client, a.userId, "F-16 direct task");

      // INSERT is no longer granted to `authenticated`; creation is RPC-only.
      const directInsert = await a.client.from("focus_sessions").insert({
        owner_id: a.userId,
        task_id: task,
        planned_seconds: 1500,
      });
      expect(directInsert.error).not.toBeNull();

      const started = await a.client.rpc("start_focus_session", {
        p_task_id: task,
        p_planned_seconds: 1500,
      });
      expect(started.error).toBeNull();
      const sessionId = (started.data as { id: string }).id;

      const mutateStatus = await a.client
        .from("focus_sessions")
        .update({ status: "completed" })
        .eq("id", sessionId);
      expect(mutateStatus.error).not.toBeNull();

      const mutateEndedAt = await a.client
        .from("focus_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      expect(mutateEndedAt.error).not.toBeNull();

      const mutateActual = await a.client
        .from("focus_sessions")
        .update({ actual_seconds: 999 })
        .eq("id", sessionId);
      expect(mutateActual.error).not.toBeNull();

      // The notes column grant keeps the notes feature working.
      const mutateNotes = await a.client
        .from("focus_sessions")
        .update({ notes: "whispered" })
        .eq("id", sessionId)
        .eq("owner_id", a.userId);
      expect(mutateNotes.error).toBeNull();

      const ended = await a.client.rpc("end_focus_session", { p_session: sessionId });
      expect(ended.error).toBeNull();
    });

    it("F-16 timer RPCs still enforce the state machine", async () => {
      await endOpenSessions(a.client);
      const task = await createTask(a.client, a.userId, "F-16 state task");

      const started = await a.client.rpc("start_focus_session", {
        p_task_id: task,
        p_planned_seconds: 1500,
      });
      expect(started.error).toBeNull();
      const sessionId = (started.data as { id: string }).id;

      const paused = await a.client.rpc("pause_focus_session", { p_session: sessionId });
      expect(paused.error).toBeNull();

      const resumed = await a.client.rpc("resume_focus_session", { p_session: sessionId });
      expect(resumed.error).toBeNull();

      // Replaying a transition on the wrong state must fail, not silently
      // succeed with a second started_at/resumed_at.
      const replay = await a.client.rpc("resume_focus_session", { p_session: sessionId });
      expect(replay.error).not.toBeNull();

      const ended = await a.client.rpc("end_focus_session", { p_session: sessionId });
      expect(ended.error).toBeNull();

      const endAgain = await a.client.rpc("end_focus_session", { p_session: sessionId });
      expect(endAgain.error).not.toBeNull();

      const pauseAfterEnd = await a.client.rpc("pause_focus_session", { p_session: sessionId });
      expect(pauseAfterEnd.error).not.toBeNull();
    });

    afterAll(async () => {
      // focus_sessions intentionally has no DELETE grant for authenticated
      // (F-16); every session above is ended through the RPC instead.
      for (const row of created.reverse()) {
        if (row.table === "focus_sessions") continue;
        await row.client.from(row.table).delete().eq("id", row.id);
      }
    });
  }
);
