import type { Task, TaskStatus } from "@/lib/types/models";

export const MAX_TOP_PRIORITIES = 3;
export const MAX_SUBTASK_DEPTH = 2;

export const TASK_STATUSES: TaskStatus[] = [
  "inbox",
  "todo",
  "in_progress",
  "done",
  "cancelled",
];

/** Root tasks are depth 0, their subtasks depth 1, and so on. */
export function canNestSubtask(parentDepth: number): boolean {
  return parentDepth < MAX_SUBTASK_DEPTH;
}

export function nextDepth(parentDepth: number): number {
  return parentDepth + 1;
}

export function canMarkTopPriority(currentCount: number): boolean {
  return currentCount < MAX_TOP_PRIORITIES;
}

export function isOpenTask(task: Pick<Task, "status" | "archived_at">): boolean {
  return !task.archived_at && task.status !== "done" && task.status !== "cancelled";
}

export function isTaskDone(task: Pick<Task, "status">): boolean {
  return task.status === "done";
}

/**
 * Task rule TASK-08: incomplete tasks are never rolled forward automatically.
 * The system always waits for a conscious user decision.
 */
export function automaticRescheduleDecision(): null {
  return null;
}

export function sortTasks(a: Task, b: Task): number {
  if (a.is_top_priority !== b.is_top_priority) return a.is_top_priority ? -1 : 1;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.created_at.localeCompare(b.created_at);
}

export interface TodayBuckets {
  topPriorities: Task[];
  scheduled: Task[];
  overdue: Task[];
  inbox: Task[];
  completed: Task[];
}

/** Builds today's dashboard buckets for a local calendar day. */
export function bucketTodayTasks(
  tasks: Task[],
  todayKey: string,
  timeZoneOffsetResolver?: (iso: string) => string
): TodayBuckets {
  const localKey = (task: Task) => task.scheduled_for ?? null;
  const open = tasks.filter((task) => isOpenTask(task));

  const topPriorities = open
    .filter((task) => task.is_top_priority && localKey(task) === todayKey)
    .sort(sortTasks)
    .slice(0, MAX_TOP_PRIORITIES);

  const scheduled = open
    .filter(
      (task) =>
        localKey(task) === todayKey && !topPriorities.some((top) => top.id === task.id)
    )
    .sort(sortTasks);

  const overdue = open
    .filter((task) => {
      const dateKey = task.due_at
        ? timeZoneOffsetResolver?.(task.due_at) ?? task.due_at.slice(0, 10)
        : null;
      return dateKey !== null && dateKey < todayKey && localKey(task) !== todayKey;
    })
    .sort(sortTasks);

  const inbox = tasks
    .filter((task) => task.status === "inbox" && !task.archived_at)
    .sort(sortTasks);

  const completed = tasks
    .filter((task) => task.status === "done" && task.completed_at)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  return { topPriorities, scheduled, overdue, inbox, completed };
}

export function completionPercent(tasks: Pick<Task, "status">[]): number {
  // Cancelled tasks were consciously dropped; counting them would penalise
  // progress that was deliberately re-scoped (matches taskProgress).
  const counted = tasks.filter((task) => task.status !== "cancelled");
  if (counted.length === 0) return 0;
  const done = counted.filter((task) => task.status === "done").length;
  return Math.round((done / counted.length) * 100);
}
