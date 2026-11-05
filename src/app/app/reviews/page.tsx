import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { ActionForm } from "@/components/shared/action-form";
import { saveWeeklyReviewAction } from "@/server/actions/reviews";
import { closeCycleAction } from "@/server/actions/cycles";
import { weeklySummary, formatMinutes } from "@/lib/domain/progress";
import { addDaysToKey, diffInDays, isValidDateKey, weekStartFor } from "@/lib/date-keys";
import { startOfLocalDayIso, todayKey } from "@/lib/time";
import { formatDateKey } from "@/lib/time";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const { t, locale } = await getI18n();
  const params = await searchParams;
  const timezone = profile?.timezone ?? "UTC";
  const today = todayKey(timezone);
  const currentWeekStart = weekStartFor(todayKey(timezone), profile?.week_start ?? "monday");
  const weekStart = params.week && isValidDateKey(params.week) ? params.week : currentWeekStart;
  const weekEnd = addDaysToKey(weekStart, 7);

  const supabase = await createClient();
  const [reviewResult, pastResult, tasksResult, sessionsResult, cycleResult, activeCycleGoals] =
    await Promise.all([
      supabase
        .from("weekly_reviews")
        .select("*")
        .eq("owner_id", user.id)
        .eq("week_start", weekStart)
        .maybeSingle(),
      supabase
        .from("weekly_reviews")
        .select("id, week_start, highlights")
        .eq("owner_id", user.id)
        .order("week_start", { ascending: false })
        .limit(6),
      supabase
        .from("tasks")
        .select("id, status, completed_at, title")
        .eq("owner_id", user.id)
        .order("sort_order", { ascending: true })
        .limit(500),
      supabase
        .from("focus_sessions")
        .select("actual_seconds, status, started_at")
        .eq("owner_id", user.id)
        .gte("started_at", startOfLocalDayIso(weekStart, timezone))
        .lt("started_at", startOfLocalDayIso(weekEnd, timezone)),
      supabase
        .from("focus_cycles")
        .select("*")
        .eq("owner_id", user.id)
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("focus_cycle_goals")
        .select("goal_id, role")
        .eq("owner_id", user.id),
    ]);

  const review = reviewResult.data;
  assertRead(
    [reviewResult, pastResult, tasksResult, sessionsResult, cycleResult, activeCycleGoals],
    "reviews"
  );

  const pastReviews = pastResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const activeCycle = cycleResult.data;
  const cycleGoals = activeCycleGoals.data ?? [];

  const summary = weeklySummary({
    tasks: tasks.filter(
      (task) =>
        task.completed_at &&
        task.completed_at >= startOfLocalDayIso(weekStart, timezone) &&
        task.completed_at < startOfLocalDayIso(weekEnd, timezone)
    ),
    sessions,
    reviews: review ? 1 : 0,
  });

  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const primaryGoalId = cycleGoals.find(
    (row) => row.role === "primary" && row.goal_id
  )?.goal_id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reviews.title")}
        subtitle={t("reviews.subtitle")}
        actions={
          <form method="get" className="flex items-end gap-2">
            <Field label={t("reviews.weekly")} htmlFor="week">
              <input
                id="week"
                name="week"
                type="date"
                defaultValue={weekStart}
                className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              />
            </Field>
            <button
              type="submit"
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm font-medium"
            >
              {t("common.select")}
            </button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("reviews.tasks-completed"), value: summary.tasksCompleted },
          { label: t("reviews.focus-time"), value: formatMinutes(summary.focusSeconds, locale) },
          { label: t("reviews.sessions"), value: summary.focusSessions },
          { label: t("reviews.open-tasks"), value: openTasks.length },
        ].map((stat) => (
          <div key={stat.label} className="surface p-3">
            <p className="text-xs text-[var(--color-muted)]">{stat.label}</p>
            <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="surface p-5">
          <h2 className="text-sm font-semibold">
            {t("reviews.week-of", { date: formatDateKey(weekStart, locale) })}
          </h2>
          <p className="mb-4 text-xs text-[var(--color-muted)]">{t("journal.privacy-note")}</p>

          <ActionForm
            action={saveWeeklyReviewAction}
            submitLabel={t("reviews.submit")}
            showSuccess
            fields={{ weekStart }}
          >
            <div className="space-y-3 pb-3">
              <Field label={t("reviews.highlights")} htmlFor="highlights">
                <Textarea
                  id="highlights"
                  name="highlights"
                  rows={2}
                  defaultValue={review?.highlights ?? ""}
                />
              </Field>
              <Field label={t("reviews.obstacles")} htmlFor="obstacles">
                <Textarea
                  id="obstacles"
                  name="obstacles"
                  rows={2}
                  defaultValue={review?.obstacles ?? ""}
                />
              </Field>
              <Field label={t("reviews.learnings")} htmlFor="learnings">
                <Textarea
                  id="learnings"
                  name="learnings"
                  rows={2}
                  defaultValue={review?.learnings ?? ""}
                />
              </Field>
              <Field label={t("reviews.next-week-focus")} htmlFor="nextWeekFocus">
                <Textarea
                  id="nextWeekFocus"
                  name="nextWeekFocus"
                  rows={2}
                  defaultValue={review?.next_week_focus ?? ""}
                />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="keepFocus"
                  defaultChecked={review?.keep_focus ?? true}
                />
                {t("reviews.keep-focus")}
              </label>
            </div>
          </ActionForm>
        </section>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("reviews.open-tasks")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-[var(--color-muted)]">{t("reviews.open-tasks-hint")}</p>
              {openTasks.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">{t("reviews.no-data")}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {openTasks.slice(0, 6).map((task) => (
                    <li key={task.id} className="truncate">
                      {task.title}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/app/tasks" className="inline-block text-xs text-[var(--color-primary)] hover:underline">
                {t("nav.tasks")}
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("reviews.cycle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeCycle ? (
                <>
                  <p className="text-sm font-medium">
                    {activeCycle.title ?? t("insights.active-cycle")}
                  </p>
                  <ProgressBar
                    value={
                      (Math.min(
                        Math.max(0, diffInDays(today, activeCycle.start_date)),
                        Math.max(1, diffInDays(activeCycle.end_date, activeCycle.start_date))
                      ) /
                        Math.max(1, diffInDays(activeCycle.end_date, activeCycle.start_date))) *
                      100
                    }
                    label={t("insights.cycle-progress")}
                  />
                  <p className="text-xs text-[var(--color-muted)]">
                    {t("cycle.until", {
                      date: formatDateKey(activeCycle.end_date, locale),
                    })}
                  </p>
                  <ActionForm
                    action={closeCycleAction}
                    submitLabel={t("reviews.cycle-outcome")}
                    variant="secondary"
                    size="sm"
                    fields={{ cycleId: activeCycle.id }}
                  >
                    <div className="space-y-2 pb-2">
                      <Field label={t("cycle.outcome")} htmlFor="outcome">
                        <Select id="outcome" name="outcome" required defaultValue="">
                          <option value="" disabled>
                            {t("common.select")}
                          </option>
                          <option value="achieved">{t("cycle.outcome.achieved")}</option>
                          <option value="progress">{t("cycle.outcome.progress")}</option>
                          <option value="direction_change">
                            {t("cycle.outcome.direction_change")}
                          </option>
                          <option value="paused">{t("cycle.outcome.paused")}</option>
                        </Select>
                      </Field>
                      <Field label={t("cycle.outcome-notes")} htmlFor="outcomeNotes">
                        <Textarea id="outcomeNotes" name="outcomeNotes" rows={2} />
                      </Field>
                    </div>
                  </ActionForm>
                  <p className="text-xs text-[var(--color-muted)]">
                    {primaryGoalId
                      ? t("today.cycle-label")
                      : t("cycle.no-active-goal")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-[var(--color-muted)]">{t("reviews.cycle-empty")}</p>
                  <Link
                    href="/app/focus-cycle"
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    {t("reviews.manage-cycle")}
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          <section aria-labelledby="past-weeks" className="space-y-2">
            <h2 id="past-weeks" className="text-sm font-semibold">
              {t("reviews.history")}
            </h2>
            {pastReviews.length === 0 ? (
              <EmptyState title={t("reviews.history-empty")} />
            ) : (
              <ul className="space-y-1">
                {pastReviews.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/app/reviews?week=${entry.week_start}`}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm hover:bg-[var(--color-surface-secondary)]"
                    >
                      <span>{formatDateKey(entry.week_start, locale)}</span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {entry.highlights ? entry.highlights.slice(0, 40) : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
