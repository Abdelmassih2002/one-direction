"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId, getCurrentProfile } from "@/lib/auth/session";
import { canMarkTopPriority } from "@/lib/domain/tasks";
import { tomorrowKey, todayKey } from "@/lib/time";
import { formString, optionalUuid } from "@/lib/validation/common";
import {
  quickTaskSchema,
  taskPrioritySchema,
  taskRescheduleSchema,
  taskSchema,
} from "@/lib/validation/task";
import { dbFailure, readBoolean, success, validationFailure } from "./helpers";
import type { ActionState } from "./types";
import type { Task, TaskStatus } from "@/lib/types/models";

function taskPaths(id?: string) {
  revalidatePath("/app/tasks");
  revalidatePath("/app/today");
  revalidatePath("/app/projects");
  revalidatePath("/app/insights");
  if (id) revalidatePath(`/app/tasks/${id}`);
}

async function nextSortOrder(userId: string, scheduledFor: string | null): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("sort_order")
    .eq("owner_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1);
  query = scheduledFor ? query.eq("scheduled_for", scheduledFor) : query.is("scheduled_for", null);
  const { data } = await query.maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

export async function quickCaptureAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = quickTaskSchema.safeParse({ title: formString(formData.get("title")) });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      owner_id: userId,
      title: parsed.data.title,
      status: "inbox",
      sort_order: await nextSortOrder(userId, null),
    })
    .select("id")
    .single();
  if (error) return dbFailure(error.message);

  taskPaths(data.id);
  return success(data.id);
}

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = taskSchema.safeParse({
    title: formString(formData.get("title")),
    description: formString(formData.get("description")) || undefined,
    status: formString(formData.get("status")) || "todo",
    goalId: formString(formData.get("goalId")) || undefined,
    projectId: formString(formData.get("projectId")) || undefined,
    milestoneId: formString(formData.get("milestoneId")) || undefined,
    parentTaskId: formString(formData.get("parentTaskId")) || undefined,
    estimateMinutes: formString(formData.get("estimateMinutes")) || undefined,
    scheduledFor: formString(formData.get("scheduledFor")) || undefined,
    dueAt: formString(formData.get("dueAt")) || undefined,
    isTopPriority: readBoolean(formData.get("isTopPriority")),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  if (parsed.data.isTopPriority && !parsed.data.scheduledFor) {
    return { status: "error", messageKey: "tasks.errors.top-date" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      owner_id: userId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      goal_id: parsed.data.goalId ?? null,
      project_id: parsed.data.projectId ?? null,
      milestone_id: parsed.data.milestoneId ?? null,
      parent_task_id: parsed.data.parentTaskId ?? null,
      estimate_minutes: parsed.data.estimateMinutes ?? null,
      scheduled_for: parsed.data.scheduledFor ?? null,
      due_at: parsed.data.dueAt ?? null,
      is_top_priority: parsed.data.isTopPriority,
      sort_order: await nextSortOrder(userId, parsed.data.scheduledFor ?? null),
    })
    .select("id")
    .single();
  if (error) return dbFailure(error.message);

  taskPaths(data.id);
  return success(data.id);
}

export async function updateTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const parsed = taskSchema.safeParse({
    title: formString(formData.get("title")),
    description: formString(formData.get("description")) || undefined,
    status: formString(formData.get("status")) || "todo",
    goalId: optionalUuid.parse(formString(formData.get("goalId")) || undefined),
    projectId: optionalUuid.parse(formString(formData.get("projectId")) || undefined),
    milestoneId: optionalUuid.parse(formString(formData.get("milestoneId")) || undefined),
    parentTaskId: optionalUuid.parse(formString(formData.get("parentTaskId")) || undefined),
    estimateMinutes: formString(formData.get("estimateMinutes")) || undefined,
    scheduledFor: formString(formData.get("scheduledFor")) || undefined,
    dueAt: formString(formData.get("dueAt")) || undefined,
    isTopPriority: readBoolean(formData.get("isTopPriority")),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      goal_id: parsed.data.goalId ?? null,
      project_id: parsed.data.projectId ?? null,
      milestone_id: parsed.data.milestoneId ?? null,
      parent_task_id: parsed.data.parentTaskId ?? null,
      estimate_minutes: parsed.data.estimateMinutes ?? null,
      scheduled_for: parsed.data.scheduledFor ?? null,
      due_at: parsed.data.dueAt ?? null,
      is_top_priority: parsed.data.isTopPriority,
      completed_at:
        parsed.data.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  taskPaths(id);
  return success(id);
}

export async function setTaskStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const status = formString(formData.get("status"));
  const allowed: TaskStatus[] = ["inbox", "todo", "in_progress", "done", "cancelled"];
  if (!allowed.includes(status as TaskStatus)) {
    return { status: "error", messageKey: "errors.invalid-input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      status: status as TaskStatus,
      completed_at: status === "done" ? new Date().toISOString() : null,
      is_top_priority: status === "done" || status === "cancelled" ? false : undefined,
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  taskPaths(id);
  return success(id);
}

export async function toggleTopPriorityAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = taskPrioritySchema.safeParse({
    isTopPriority: readBoolean(formData.get("isTopPriority")),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const id = formString(formData.get("id"));
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("id, scheduled_for, is_top_priority")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!task) return { status: "error", messageKey: "errors.forbidden" };

  let scheduledFor = task.scheduled_for;
  if (parsed.data.isTopPriority && !scheduledFor) {
    const profile = await getCurrentProfile();
    scheduledFor = todayKey(profile?.timezone ?? "UTC");
  }

  if (parsed.data.isTopPriority && scheduledFor) {
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("scheduled_for", scheduledFor)
      .eq("is_top_priority", true);
    if (!canMarkTopPriority(count ?? 0)) {
      return { status: "error", messageKey: "tasks.errors.top-limit" };
    }
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      is_top_priority: parsed.data.isTopPriority,
      ...(parsed.data.isTopPriority && scheduledFor ? { scheduled_for: scheduledFor } : {}),
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  taskPaths(id);
  return { status: "success", id };
}

export async function rescheduleTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const parsed = taskRescheduleSchema.safeParse({
    action: formString(formData.get("action")),
    scheduledFor: formString(formData.get("scheduledFor")) || undefined,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const profile = await getCurrentProfile();
  const timezone = profile?.timezone ?? "UTC";
  const updates: Partial<Task> = { is_top_priority: false };

  if (parsed.data.action === "tomorrow") {
    updates.scheduled_for = tomorrowKey(timezone);
  } else if (parsed.data.action === "date") {
    if (!parsed.data.scheduledFor) return { status: "error", messageKey: "errors.invalid-input" };
    updates.scheduled_for = parsed.data.scheduledFor;
  } else if (parsed.data.action === "inbox") {
    updates.scheduled_for = null;
    updates.status = "inbox";
  } else {
    updates.status = "cancelled";
    updates.scheduled_for = null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  taskPaths(id);
  return success(id);
}

export async function reorderTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const direction = formString(formData.get("direction"));

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, scheduled_for, sort_order, status")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!task) return { status: "error", messageKey: "errors.forbidden" };

  let query = supabase
    .from("tasks")
    .select("id, sort_order")
    .eq("owner_id", userId)
    .eq("status", task.status)
    .order("sort_order", { ascending: true });
  query = task.scheduled_for
    ? query.eq("scheduled_for", task.scheduled_for)
    : query.is("scheduled_for", null);
  const { data: siblings, error } = await query;
  if (error) return dbFailure(error.message);

  const index = siblings?.findIndex((sibling) => sibling.id === id) ?? -1;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (!siblings || index < 0 || swapWith < 0 || swapWith >= siblings.length) return success(id);

  const current = siblings[index];
  const neighbour = siblings[swapWith];
  await supabase
    .from("tasks")
    .update({ sort_order: neighbour.sort_order })
    .eq("id", current.id)
    .eq("owner_id", userId);
  await supabase
    .from("tasks")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbour.id)
    .eq("owner_id", userId);

  taskPaths(id);
  return success(id);
}

export async function deleteTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id).eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  taskPaths(id);
  return success(id);
}

