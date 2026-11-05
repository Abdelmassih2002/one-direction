import type { FocusSession, Goal, Milestone, Task } from "@/lib/types/models";

export interface ProgressSummary {
  done: number;
  total: number;
  percent: number;
}

export function taskProgress(tasks: Pick<Task, "status">[]): ProgressSummary {
  const total = tasks.filter((task) => task.status !== "cancelled").length;
  const done = tasks.filter((task) => task.status === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function milestoneProgress(milestones: Pick<Milestone, "status">[]): ProgressSummary {
  const total = milestones.length;
  const done = milestones.filter((milestone) => milestone.status === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * A goal's displayed progress is always the user's manual value (GOAL-04);
 * task completion is shown separately and never overwrites the manual number.
 */
export function goalDisplayProgress(goal: Pick<Goal, "progress">): number {
  return Math.min(100, Math.max(0, Math.round(goal.progress)));
}

export interface WeeklySummary {
  tasksCompleted: number;
  focusSeconds: number;
  focusSessions: number;
  reviewsWritten: number;
  documentedProgress: boolean;
}

export function weeklySummary(input: {
  tasks: Pick<Task, "status" | "completed_at">[];
  sessions: Pick<FocusSession, "actual_seconds" | "status">[];
  reviews: number;
}): WeeklySummary {
  const tasksCompleted = input.tasks.filter((task) => task.status === "done").length;
  const completedSessions = input.sessions.filter(
    (session) => session.status === "completed"
  );
  const focusSeconds = completedSessions.reduce(
    (total, session) => total + (session.actual_seconds ?? 0),
    0
  );

  return {
    tasksCompleted,
    focusSeconds,
    focusSessions: completedSessions.length,
    reviewsWritten: input.reviews,
    documentedProgress:
      tasksCompleted > 0 || completedSessions.length > 0 || input.reviews > 0,
  };
}

export function formatMinutes(seconds: number, locale: "en" | "ar"): string {
  const minutes = Math.round(seconds / 60);
  if (locale === "ar") {
    if (minutes < 60) return `${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} ساعة` : `${hours} ساعة و${rest} دقيقة`;
  }
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
