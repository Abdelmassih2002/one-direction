import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { assertRead } from "@/lib/supabase/read";
import { PageHeader, EmptyState } from "@/components/ui/feedback";
import { FocusTimer } from "@/components/focus/focus-timer";
import { formatClock, DEFAULT_PLANNED_MINUTES } from "@/lib/domain/timer";
import { formatInstant } from "@/lib/time";
import type { Task } from "@/lib/types/models";

export const metadata: Metadata = { title: "Focus" };

export default async function FocusPage() {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const [sessionResult, tasksResult, historyResult] = await Promise.all([
    supabase
      .from("focus_sessions")
      .select("*")
      .eq("owner_id", user.id)
      .is("ended_at", null)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("*")
      .eq("owner_id", user.id)
      .in("status", ["todo", "in_progress", "inbox"])
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .limit(100),
    supabase
      .from("focus_sessions")
      .select("*")
      .eq("owner_id", user.id)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(8),
  ]);

  const session = sessionResult.data;
  assertRead([tasksResult, historyResult], "focus");

  const tasks = (tasksResult.data ?? []) as Task[];
  const history = historyResult.data ?? [];

  const allTaskIds = Array.from(
    new Set([...tasks.map((task) => task.id), ...history.map((item) => item.task_id ?? "")])
  ).filter(Boolean);

  const { data: referencedTasks } = allTaskIds.length
    ? await supabase
        .from("tasks")
        .select("id, title")
        .eq("owner_id", user.id)
        .in("id", allTaskIds)
    : { data: [] };

  const taskTitle = (id: string | null) =>
    referencedTasks?.find((task) => task.id === id)?.title ?? t("focus.no-task");

  const activeTask = session?.task_id
    ? ({ id: session.task_id, title: taskTitle(session.task_id) } as Task)
    : null;

  const lastCompleted = history.find((item) => item.status === "completed");

  return (
    <div className="space-y-6">
      <PageHeader title={t("focus.title")} subtitle={t("focus.subtitle")} />

      <FocusTimer
        session={session}
        activeTask={activeTask}
        tasks={tasks}
        defaultMinutes={DEFAULT_PLANNED_MINUTES}
        lastDuration={session ? null : lastCompleted?.actual_seconds ?? null}
      />

      <section aria-labelledby="session-history" className="space-y-2">
        <h2 id="session-history" className="text-sm font-semibold">
          {t("focus.history")}
        </h2>
        {history.length === 0 ? (
          <EmptyState title={t("focus.history-empty")} />
        ) : (
          <ul className="space-y-2">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{taskTitle(item.task_id)}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {formatInstant(item.started_at, "UTC", locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                  <span className="tabular-nums" dir="ltr">
                    {formatClock(item.actual_seconds ?? 0)}
                  </span>
                  <span>
                    {t("focus.interruptions")}: {item.interruptions}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
