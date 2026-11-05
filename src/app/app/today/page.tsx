import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, MoonStar, Timer } from "lucide-react";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { bucketTodayTasks } from "@/lib/domain/tasks";
import { currentHour, endOfLocalDayIso, greetingKey, nextQuarterHourLocal, startOfLocalDayIso, todayKey, tomorrowKey } from "@/lib/time";
import { weekStartFor } from "@/lib/date-keys";
import { PageHeader, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TaskItem } from "@/components/tasks/task-item";
import { QuickCapture } from "@/components/today/quick-capture";
import { ScheduleBlockForm } from "@/components/today/schedule-block-form";
import { ActionButton } from "@/components/shared/action-form";
import { deleteScheduleBlockAction } from "@/server/actions/schedule";
import { formatDateKey, formatInstant, formatTimeRange, localDateKey } from "@/lib/time";
import type { MessageKey } from "@/lib/i18n";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const { t, locale } = await getI18n();

  const timezone = profile?.timezone ?? "UTC";
  const today = todayKey(timezone);
  const weekStart = weekStartFor(today, profile?.week_start ?? "monday");
  const supabase = await createClient();

  const [cycleResult, tasksResult, goalsResult, blocksResult, sessionResult, weekSessionsResult] =
    await Promise.all([
      supabase
        .from("focus_cycles")
        .select("*")
        .eq("owner_id", user.id)
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("*")
        .eq("owner_id", user.id)
        .is("archived_at", null)
        .limit(500),
      supabase
        .from("goals")
        .select("*")
        .eq("owner_id", user.id)
        .is("archived_at", null)
        .limit(500),
      supabase
        .from("schedule_blocks")
        .select("*")
        .eq("owner_id", user.id)
        .gte("start_at", startOfLocalDayIso(today, timezone))
        .lt("start_at", endOfLocalDayIso(today, timezone))
        .order("start_at", { ascending: true }),
      supabase
        .from("focus_sessions")
        .select("*")
        .eq("owner_id", user.id)
        .is("ended_at", null)
        .maybeSingle(),
      supabase
        .from("focus_sessions")
        .select("actual_seconds, status")
        .eq("owner_id", user.id)
        .eq("status", "completed")
        .gte("started_at", startOfLocalDayIso(weekStart, timezone)),
    ]);

  const cycle = cycleResult.data;
  const tasks = tasksResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const blocks = blocksResult.data ?? [];
  const activeSession = sessionResult.data;
  const weekSessions = weekSessionsResult.data ?? [];

  const cycleGoalsResult = cycle
    ? await supabase
        .from("focus_cycle_goals")
        .select("*")
        .eq("owner_id", user.id)
        .eq("cycle_id", cycle.id)
    : null;

  assertRead(
    [
      cycleResult,
      tasksResult,
      goalsResult,
      blocksResult,
      sessionResult,
      weekSessionsResult,
      ...(cycleGoalsResult ? [cycleGoalsResult] : []),
    ],
    "today"
  );

  const cycleGoals = cycleGoalsResult?.data ?? [];

  const primaryAssignment = cycleGoals.find((assignment) => assignment.role === "primary");
  const primaryGoal = goals.find((goal) => goal.id === primaryAssignment?.goal_id) ?? null;
  const secondaryGoals = cycleGoals
    .filter((assignment) => assignment.role === "secondary")
    .map((assignment) => goals.find((goal) => goal.id === assignment.goal_id))
    .filter((goal): goal is NonNullable<typeof goal> => Boolean(goal));

  const buckets = bucketTodayTasks(tasks, today, (iso) => localDateKey(iso, timezone));
  const completedToday = tasks.filter(
    (task) => task.status === "done" && task.completed_at && localDateKey(task.completed_at, timezone) === today
  ).length;
  const focusSecondsThisWeek = weekSessions.reduce((total, session) => total + (session.actual_seconds ?? 0), 0);
  const defaultStart = nextQuarterHourLocal(timezone);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(greetingKey(currentHour(timezone)), {
          name: profile?.display_name ? `, ${profile.display_name}` : "",
        })}
        subtitle={formatDateKey(today, locale, { weekday: "long", day: "numeric", month: "long" })}
        actions={
          <Button asChild>
            <Link href={activeSession ? "/app/focus" : buckets.topPriorities[0] ? `/app/focus?taskId=${buckets.topPriorities[0].id}` : "/app/focus"}>
              <Timer className="size-4" aria-hidden="true" />
              {activeSession ? t("focus.active") : t("today.start-focus")}
            </Link>
          </Button>
        }
      />

      {/* Current direction */}
      <Card className="border-[var(--color-primary)]/25 bg-[var(--color-primary-soft)]/50">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-primary)]">
                <Compass className="size-3.5" aria-hidden="true" />
                {t("today.cycle-label")}
              </p>
              {cycle && primaryGoal ? (
                <>
                  <Link
                    href={`/app/goals/${primaryGoal.id}`}
                    className="text-lg font-semibold hover:underline"
                  >
                    {primaryGoal.title}
                  </Link>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("cycle.until", { date: formatDateKey(cycle.end_date, locale) })}
                  </p>
                  {secondaryGoals.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {secondaryGoals.map((goal) => (
                        <Badge key={goal.id} tone="neutral">
                          {goal.title}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : cycle ? (
                <p className="text-sm">{t("cycle.no-active-goal")}</p>
              ) : (
                <>
                  <p className="text-base font-semibold">{t("today.no-cycle")}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("today.no-cycle-body")}
                  </p>
                </>
              )}
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/app/focus-cycle">
                {cycle ? t("cycle.edit-goals") : t("cycle.empty.cta")}
                <ArrowRight className="size-3.5 flip-rtl" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <section aria-labelledby="top-priorities" className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 id="top-priorities" className="text-sm font-semibold">
                  {t("today.top-title")}
                </h2>
                <p className="text-xs text-[var(--color-muted)]">{t("today.top-hint")}</p>
              </div>
              <Link href="/app/tasks" className="text-xs text-[var(--color-primary)] hover:underline">
                {t("common.view-all")}
              </Link>
            </div>

            {buckets.topPriorities.length === 0 ? (
              <EmptyState title={t("today.top-empty")} body={t("today.empty-body")} />
            ) : (
              <ul className="space-y-2">
                {buckets.topPriorities.map((task) => (
                  <TaskItem key={task.id} task={task} timezone={timezone} today={today} showPriorityToggle />
                ))}
              </ul>
            )}
          </section>

          {buckets.scheduled.length > 0 ? (
            <section aria-labelledby="also-today" className="space-y-2">
              <h2 id="also-today" className="text-sm font-semibold">
                {t("today.tasks-title")}
              </h2>
              <ul className="space-y-2">
                {buckets.scheduled.map((task) => (
                  <TaskItem key={task.id} task={task} timezone={timezone} today={today} showPriorityToggle />
                ))}
              </ul>
            </section>
          ) : null}

          {buckets.overdue.length > 0 ? (
            <section aria-labelledby="needs-decision" className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-accent-soft)]/40 p-4">
              <h2 id="needs-decision" className="text-sm font-semibold">
                {t("today.overdue-title")}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("today.overdue-body")}
              </p>
              <ul className="space-y-2">
                {buckets.overdue.slice(0, 4).map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] bg-[var(--color-surface)] p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{task.title}</p>
                      {task.due_at ? (
                        <p className="text-xs text-[var(--color-danger)]">
                          {formatInstant(task.due_at, timezone, locale, { dateStyle: "medium" })}
                        </p>
                      ) : null}
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/app/tasks?reschedule=${task.id}`}>{t("tasks.reschedule")}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <section aria-labelledby="today-plan" className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 id="today-plan" className="text-sm font-semibold">
              {t("today.schedule-title")}
            </h2>

            {blocks.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">{t("today.no-blocks")}</p>
            ) : (
              <ul className="space-y-2">
                {blocks.map((block) => (
                  <li key={block.id} className="flex items-start justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] p-2.5">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-sm">
                        {block.block_type === "rest" ? (
                          <MoonStar className="size-3.5 text-[var(--color-accent)]" aria-hidden="true" />
                        ) : null}
                        <span className="truncate font-medium">
                          {block.title || t(`today.block.${block.block_type}` as MessageKey)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-muted)]" dir="ltr">
                        {formatTimeRange(block.start_at, block.end_at, timezone, locale)}
                      </p>
                    </div>
                    <ActionButton
                      action={deleteScheduleBlockAction}
                      fields={{ id: block.id }}
                      ariaLabel={t("common.delete")}
                    >
                      ×
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}

            <details className="pt-1">
              <summary className="cursor-pointer text-xs font-medium text-[var(--color-primary)]">
                {t("today.add-block")}
              </summary>
              <div className="pt-3">
                <ScheduleBlockForm date={today} defaultStart={defaultStart} />
              </div>
            </details>
          </section>

          <section aria-labelledby="capture" className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 id="capture" className="text-sm font-semibold">
              {t("today.capture")}
            </h2>
            <QuickCapture />
            <p className="text-xs text-[var(--color-muted)]">{t("tasks.inbox-hint")}</p>
            {buckets.inbox.length > 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("common.items", { count: buckets.inbox.length })}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="progress" className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 id="progress" className="text-sm font-semibold">
              {t("today.progress-title")}
            </h2>
            <ProgressBar
              value={buckets.topPriorities.length === 0 ? 0 : (completedToday / Math.max(1, completedToday + buckets.topPriorities.length)) * 100}
              label={t("insights.tasks-completed")}
            />
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-secondary)] p-2">
                <dt className="text-[var(--color-muted)]">{t("insights.tasks-completed")}</dt>
                <dd className="text-base font-semibold tabular-nums">{completedToday}</dd>
              </div>
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-secondary)] p-2">
                <dt className="text-[var(--color-muted)]">{t("insights.focus-time")}</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {Math.round(focusSecondsThisWeek / 60)}
                  <span className="text-xs font-normal"> {t("common.minutes", { count: "" }).trim()}</span>
                </dd>
              </div>
            </dl>
            <p className="text-xs text-[var(--color-muted)]">{t("today.rest-note")}</p>
          </section>
        </div>
      </div>

      {buckets.overdue.length > 0 ? (
        <p className="text-xs text-[var(--color-muted)]">
          {t("today.return-body")}{" "}
          <Link href="/app/focus-cycle" className="text-[var(--color-primary)] hover:underline">
            {t("today.return-cta")}
          </Link>
        </p>
      ) : null}

      <p className="sr-only">{tomorrowKey(timezone)}</p>
    </div>
  );
}
