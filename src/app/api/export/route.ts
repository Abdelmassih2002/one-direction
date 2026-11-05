import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/paginate";

export const dynamic = "force-dynamic";

/**
 * AUTH-07: exports only rows owned by the signed-in user. Ownership is
 * enforced by the query (`owner_id = auth.uid()`) and by RLS underneath.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [profiles, lifeAreas, goals, focusCycles, focusCycleGoals, projects, milestones, tasks, scheduleBlocks, focusSessions, dailyReviews, weeklyReviews] =
    await Promise.all([
      fetchAllPages((from, to) =>
        supabase.from("profiles").select("*").eq("id", user.id).order("id").range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("life_areas")
          .select("*")
          .eq("owner_id", user.id)
          .order("id")
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase.from("goals").select("*").eq("owner_id", user.id).order("id").range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("focus_cycles")
          .select("*")
          .eq("owner_id", user.id)
          .order("id")
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("focus_cycle_goals")
          .select("*")
          .eq("owner_id", user.id)
          .order("id")
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase.from("projects").select("*").eq("owner_id", user.id).order("id").range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("milestones")
          .select("*")
          .eq("owner_id", user.id)
          .order("id")
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase.from("tasks").select("*").eq("owner_id", user.id).order("id").range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("schedule_blocks")
          .select("*")
          .eq("owner_id", user.id)
          .order("id")
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("focus_sessions")
          .select("*")
          .eq("owner_id", user.id)
          .order("id")
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("daily_reviews")
          .select("*")
          .eq("owner_id", user.id)
          .order("id")
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("weekly_reviews")
          .select("*")
          .eq("owner_id", user.id)
          .order("id")
          .range(from, to)
      ),
    ]);

  const results = [
    profiles,
    lifeAreas,
    goals,
    focusCycles,
    focusCycleGoals,
    projects,
    milestones,
    tasks,
    scheduleBlocks,
    focusSessions,
    dailyReviews,
    weeklyReviews,
  ];

  if (results.some((result) => result.failed)) {
    return NextResponse.json(
      { error: "export_failed" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null },
    profiles: profiles.rows,
    life_areas: lifeAreas.rows,
    goals: goals.rows,
    focus_cycles: focusCycles.rows,
    focus_cycle_goals: focusCycleGoals.rows,
    projects: projects.rows,
    milestones: milestones.rows,
    tasks: tasks.rows,
    schedule_blocks: scheduleBlocks.rows,
    focus_sessions: focusSessions.rows,
    daily_reviews: dailyReviews.rows,
    weekly_reviews: weeklyReviews.rows,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="one-direction-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
