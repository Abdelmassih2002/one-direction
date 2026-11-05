import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function firstError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "unknown_error";
}

/** Maps database trigger errors to stable, translatable error codes. */
export function mapDbError(message: string | undefined): string {
  if (!message) return "errors.generic";
  const known: Record<string, string> = {
    top_priority_limit_reached: "errors.top-priority-limit",
    top_priority_requires_scheduled_date: "errors.top-priority-date",
    task_depth_exceeded: "errors.subtask-depth",
    task_goal_owner_mismatch: "errors.invalid-link",
    task_project_owner_mismatch: "errors.invalid-link",
    task_milestone_owner_mismatch: "errors.invalid-link",
    task_parent_owner_mismatch: "errors.invalid-link",
    cycle_goal_cycle_owner_mismatch: "errors.invalid-link",
    cycle_goal_goal_owner_mismatch: "errors.invalid-link",
    project_goal_owner_mismatch: "errors.invalid-link",
    milestone_project_owner_mismatch: "errors.invalid-link",
    not_authenticated: "errors.unauthorized",
  };
  for (const [key, value] of Object.entries(known)) {
    if (message.includes(key)) return value;
  }
  return "errors.generic";
}

export function truncate(text: string, length = 80): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/app/today";
  return next;
}
