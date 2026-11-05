import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * F-01..F-05 integration checks. These talk to a real Supabase project with
 * two real accounts and exercise the REST API directly (not the UI), which is
 * the threat model the review describes. They skip unless credentials exist.
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

const configured = Boolean(
  url && anonKey && accountA.email && accountA.password && accountB.email && accountB.password
);

type Session = { client: SupabaseClient; userId: string };

async function signIn(account: { email?: string; password?: string }): Promise<Session> {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email!,
    password: account.password!,
  });
  if (error || !data.user) throw new Error(`sign-in failed: ${error?.message ?? "no user"}`);
  return { client, userId: data.user.id };
}

const created: { client: SupabaseClient; table: string; id: string }[] = [];

function track(client: SupabaseClient, table: string, id: string) {
  created.push({ client, table, id });
}

describe.skipIf(!configured)("database ownership and invariants against a live project", () => {
  let a: Session;
  let b: Session;

  it("signs in both test accounts", async () => {
    a = await signIn(accountA);
    b = await signIn(accountB);
    expect(a.userId).not.toBe(b.userId);
  });

  it("F-01 rejects a goal linked to another user's life area", async () => {
    const { data: area, error: areaError } = await b.client
      .from("life_areas")
      .insert({ owner_id: b.userId, name: "B private area" })
      .select("id")
      .single();
    expect(areaError).toBeNull();
    track(b.client, "life_areas", area!.id);

    const { error } = await a.client
      .from("goals")
      .insert({ owner_id: a.userId, title: "cross owner", life_area_id: area!.id });
    expect(error).not.toBeNull();
  });

  it("F-01 rejects a schedule block linked to another user's task", async () => {
    const { data: task, error: taskError } = await b.client
      .from("tasks")
      .insert({ owner_id: b.userId, title: "B task" })
      .select("id")
      .single();
    expect(taskError).toBeNull();
    track(b.client, "tasks", task!.id);

    const { error } = await a.client.from("schedule_blocks").insert({
      owner_id: a.userId,
      task_id: task!.id,
      block_type: "focus",
      start_at: new Date(Date.now() + 3_600_000).toISOString(),
      end_at: new Date(Date.now() + 7_200_000).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("F-03 rejects a two-node task cycle", async () => {
    const { data: first, error: firstError } = await a.client
      .from("tasks")
      .insert({ owner_id: a.userId, title: "cycle A" })
      .select("id")
      .single();
    expect(firstError).toBeNull();
    track(a.client, "tasks", first!.id);

    const { data: second, error: secondError } = await a.client
      .from("tasks")
      .insert({ owner_id: a.userId, title: "cycle B", parent_task_id: first!.id })
      .select("id")
      .single();
    expect(secondError).toBeNull();
    track(a.client, "tasks", second!.id);

    const { error } = await a.client
      .from("tasks")
      .update({ parent_task_id: second!.id })
      .eq("id", first!.id);
    expect(error).not.toBeNull();
  });

  it("F-02 creates a cycle and replaces goals atomically", async () => {
    const { data: primary, error: primaryError } = await a.client
      .from("goals")
      .insert({ owner_id: a.userId, title: "primary goal", status: "active" })
      .select("id")
      .single();
    expect(primaryError).toBeNull();
    track(a.client, "goals", primary!.id);

    const { data: cycleId, error } = await a.client.rpc("create_focus_cycle", {
      p_title: "integration cycle",
      p_start_date: new Date().toISOString().slice(0, 10),
      p_duration_weeks: 4,
      p_primary: primary!.id,
      p_secondary: [],
      p_maintenance: [],
      p_secondary_override: false,
    });
    expect(error).toBeNull();
    expect(cycleId).toBeTruthy();

    const { data: assignments } = await a.client
      .from("focus_cycle_goals")
      .select("role")
      .eq("cycle_id", cycleId as string);
    expect(assignments).toEqual([{ role: "primary" }]);

    // Closing frees the single active-cycle slot for later runs.
    await a.client.from("focus_cycles").update({ active: false }).eq("id", cycleId as string);
    track(a.client, "focus_cycles", cycleId as string);
  });

  it("F-04 allows at most three priorities for the same day under concurrency", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const attempts = await Promise.all(
      [0, 1, 2, 3, 4].map((index) =>
        a.client
          .from("tasks")
          .insert({
            owner_id: a.userId,
            title: `priority ${index}`,
            scheduled_for: day,
            is_top_priority: true,
            status: "todo",
          })
          .select("id")
      )
    );
    const succeeded = attempts.filter((attempt) => attempt.error === null);
    for (const attempt of succeeded) {
      if (attempt.data?.[0]?.id) track(a.client, "tasks", attempt.data[0].id);
    }
    expect(succeeded.length).toBeLessThanOrEqual(3);
  });

  it("F-09 persists a changed task parent", async () => {
    const { data: parent } = await a.client
      .from("tasks")
      .insert({ owner_id: a.userId, title: "new parent" })
      .select("id")
      .single();
    track(a.client, "tasks", parent!.id);

    const { data: child } = await a.client
      .from("tasks")
      .insert({ owner_id: a.userId, title: "child" })
      .select("id")
      .single();
    track(a.client, "tasks", child!.id);

    const update = await a.client
      .from("tasks")
      .update({ parent_task_id: parent!.id })
      .eq("id", child!.id);
    expect(update.error).toBeNull();

    const { data: reread } = await a.client
      .from("tasks")
      .select("parent_task_id")
      .eq("id", child!.id)
      .single();
    expect(reread?.parent_task_id).toBe(parent!.id);
  });

  it("F-06 commits onboarding as one unit", async () => {
    const { data: cycleId, error } = await a.client.rpc("finish_onboarding", {
      p_goal_title: "onboarding goal",
      p_life_area_id: null,
      p_start_date: new Date().toISOString().slice(0, 10),
      p_duration_weeks: 2,
    });
    expect(error).toBeNull();
    expect(cycleId).toBeTruthy();

    const { data: assignments } = await a.client
      .from("focus_cycle_goals")
      .select("role, goal_id")
      .eq("cycle_id", cycleId as string);
    expect(assignments).toHaveLength(1);
    expect(assignments?.[0].role).toBe("primary");

    const { data: profile } = await a.client
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", a.userId)
      .single();
    expect(profile?.onboarding_completed_at).not.toBeNull();

    await a.client.from("focus_cycles").update({ active: false }).eq("id", cycleId as string);
    track(a.client, "focus_cycles", cycleId as string);
    if (assignments?.[0].goal_id) track(a.client, "goals", assignments[0].goal_id);
  });

  it("F-05 rejects replaying a resume on a running session", async () => {
    const { data: task } = await a.client
      .from("tasks")
      .insert({ owner_id: a.userId, title: "timer task", status: "todo" })
      .select("id")
      .single();
    track(a.client, "tasks", task!.id);

    // F-16: sessions are created through the RPC; the table no longer
    // accepts INSERT from the authenticated role.
    const { data: session, error } = await a.client.rpc("start_focus_session", {
      p_task_id: task!.id,
      p_planned_seconds: 1500,
    });
    expect(error).toBeNull();
    const sessionId = (session as { id: string }).id;
    track(a.client, "focus_sessions", sessionId);

    const first = await a.client.rpc("resume_focus_session", { p_session: sessionId });
    expect(first.error).not.toBeNull();

    const paused = await a.client.rpc("pause_focus_session", { p_session: sessionId });
    expect(paused.error).toBeNull();

    const resumed = await a.client.rpc("resume_focus_session", { p_session: sessionId });
    expect(resumed.error).toBeNull();

    const replay = await a.client.rpc("resume_focus_session", { p_session: sessionId });
    expect(replay.error).not.toBeNull();

    const ended = await a.client.rpc("end_focus_session", { p_session: sessionId });
    expect(ended.error).toBeNull();

    const endAgain = await a.client.rpc("end_focus_session", { p_session: sessionId });
    expect(endAgain.error).not.toBeNull();
  });

  afterAll(async () => {
    for (const row of created.reverse()) {
      await row.client.from(row.table).delete().eq("id", row.id);
    }
  });
});
