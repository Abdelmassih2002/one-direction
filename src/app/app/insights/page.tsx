import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, ProgressBar, EmptyState } from "@/components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoalStatusBadge } from "@/components/shared/status-badge";
import { weeklySummary, formatMinutes } from "@/lib/domain/progress";
import { completionPercent } from "@/lib/domain/tasks";
import { addDaysToKey, diffInDays, weekStartFor } from "@/lib/date-keys";
import { startOfLocalDayIso, todayKey, formatDateKey } from "@/lib/time";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage() {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const { t, locale } = await getI18n();
  const timezone = profile?.timezone ?? "UTC";
  const today = todayKey(timezone);
  const weekStart = weekStartFor(today, profile?.week_start ?? "monday");
  const weekEnd = addDaysToKey(weekStart, 7);

  const supabase = await createClient();
  const [tasksResult, sessionsResult, dailyReviewsResult, weeklyReviewResult, cycleResult, goalsResult, projectsResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id, status, completed_at, goal_id")
        .eq("owner_id", user.id)
        .limit(500),
      supabase
        .from("focus_sessions")
        .select("actual_seconds, status, started_at")
        .eq("owner_id", user.id)
        .gte("started_at", startOfLocalDayIso(weekStart, timezone))
        .lt("started_at", startOfLocalDayIso(weekEnd, timezone)),
      supabase
        .from("daily_reviews")
        .select("id")
        .eq("owner_id", user.id)
        .gte("review_date", weekStart)
        .lt("review_date", weekEnd),
      supabase
        .from("weekly_reviews")
        .select("id")
        .eq("owner_id", user.id)
        .eq("week_start", weekStart)
        .maybeSingle(),
      supabase
        .from("focus_cycles")
        .select("*")
        .eq("owner_id", user.id)
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("goals")
        .select("*")
        .eq("owner_id", user.id)
        .is("archived_at", null)
        .order("updated_at", { ascending: false }),
      supabase.from("projects").select("id, goal_id").eq("owner_id", user.id).is("archived_at", null),
    ]);

  assertRead(
    [
      tasksResult,
      sessionsResult,
      dailyReviewsResult,
      weeklyReviewResult,
      cycleResult,
      goalsResult,
      projectsResult,
    ],
    "insights"
  );

  const tasks = tasksResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const dailyReviews = dailyReviewsResult.data ?? [];
  const weeklyReview = weeklyReviewResult.data;
  const cycle = cycleResult.data;
  const goals = goalsResult.data ?? [];
  const projects = projectsResult.data ?? [];

  const weekTasks = tasks.filter(
    (task) =>
      task.completed_at &&
      task.completed_at >= startOfLocalDayIso(weekStart, timezone) &&
      task.completed_at < startOfLocalDayIso(weekEnd, timezone)
  );

  const summary = weeklySummary({
    tasks: weekTasks,
    sessions,
    reviews: dailyReviews.length + (weeklyReview ? 1 : 0),
  });

  const activeGoals = goals.filter(
    (goal) => goal.status === "active" || goal.status === "maintenance"
  );

  const daysLeft = cycle ? Math.max(0, diffInDays(cycle.end_date, today)) : 0;
  const cycleLength = cycle ? Math.max(1, diffInDays(cycle.end_date, cycle.start_date)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader title={t("insights.title")} subtitle={t("insights.subtitle")} />

      <section aria-labelledby="week-summary" className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 id="week-summary" className="text-sm font-semibold">
              {t("insights.weekly-summary")}
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              {formatDateKey(weekStart, locale)} – {formatDateKey(addDaysToKey(weekStart, 6), locale)}
            </p>
          </div>
          <Link href="/app/reviews" className="text-xs text-[var(--color-primary)] hover:underline">
            {t("insights.weekly-review")}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t("insights.tasks-completed"), value: summary.tasksCompleted },
            { label: t("insights.focus-time"), value: formatMinutes(summary.focusSeconds, locale) },
            { label: t("insights.sessions"), value: summary.focusSessions },
            {
              label: t("reviews.documented-progress"),
              value: summary.documentedProgress ? t("common.yes") : t("common.no"),
            },
          ].map((stat) => (
            <div key={stat.label} className="surface p-4">
              <p className="text-xs text-[var(--color-muted)]">{stat.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("insights.goal-progress")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeGoals.length === 0 ? (
              <EmptyState title={t("insights.goal-empty")} />
            ) : (
              <ul className="space-y-3">
                {activeGoals.map((goal) => {
                  const goalTasks = tasks.filter((task) => task.goal_id === goal.id);
                  const percent = completionPercent(goalTasks);
                  return (
                    <li key={goal.id} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`/app/goals/${goal.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {goal.title}
                        </Link>
                        <GoalStatusBadge status={goal.status} />
                      </div>
                      <ProgressBar value={goal.progress} label={t("goals.progress")} />
                      <p className="text-xs text-[var(--color-muted)]">
                        {t("insights.tasks-completed")}: {percent}% ·{" "}
                        {t("common.items", {
                          count: projects.filter((project) => project.goal_id === goal.id).length,
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-[var(--color-muted)]">{t("insights.manual-note")}</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("insights.active-cycle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cycle ? (
                <>
                  <p className="text-sm font-medium">
                    {cycle.title ?? t("cycle.status.active")}
                  </p>
                  <ProgressBar
                    value={
                      ((cycleLength - Math.min(cycleLength, daysLeft)) / cycleLength) * 100
                    }
                    label={t("insights.cycle-progress")}
                  />
                  <p className="text-xs text-[var(--color-muted)]">
                    {daysLeft > 0
                      ? t("insights.days-left", { count: daysLeft })
                      : t("insights.cycle-ended")}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {t("cycle.until", { date: formatDateKey(cycle.end_date, locale) })}
                  </p>
                  <Link
                    href="/app/focus-cycle"
                    className="inline-block text-xs text-[var(--color-primary)] hover:underline"
                  >
                    {t("reviews.manage-cycle")}
                  </Link>
                </>
              ) : (
                <p className="text-sm text-[var(--color-muted)]">{t("insights.no-cycle")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("reviews.reviews-written")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                {t("journal.title")}: <span className="font-semibold tabular-nums">{dailyReviews.length}</span>
              </p>
              <p>
                {t("reviews.weekly")}:{" "}
                <span className="font-semibold tabular-nums">{weeklyReview ? 1 : 0}</span>
              </p>
              <p className="pt-2 text-xs text-[var(--color-muted)]">{t("insights.trends-coming")}</p>
              <p className="text-xs text-[var(--color-muted)]">{t("insights.rest-note")}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-[var(--color-muted)]">{t("insights.trends-coming")}</p>
    </div>
  );
}
