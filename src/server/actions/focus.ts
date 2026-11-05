"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { plannedSecondsFromMinutes } from "@/lib/domain/timer";
import { callRpc } from "@/lib/supabase/rpc";
import { formString } from "@/lib/validation/common";
import { dbFailure, success } from "./helpers";
import type { ActionState } from "./types";

function focusPaths() {
  revalidatePath("/app/focus");
  revalidatePath("/app/today");
  revalidatePath("/app/insights");
  revalidatePath("/app/tasks");
}

/**
 * F-05: every timer transition is a single conditional update inside the
 * database, so a double submit or a stale tab cannot replay a transition,
 * resurrect an ended session, or drop accumulated focus time.
 */
function mapTimerError(message: string): ActionState {
  if (message.toLowerCase().includes("session_state_conflict")) {
    return { status: "error", messageKey: "errors.conflict" };
  }
  return dbFailure(message);
}

export async function startSessionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUserId();
  const taskId = formString(formData.get("taskId"));
  const minutes = Number(formString(formData.get("plannedMinutes")) || 25);

  if (!taskId) return { status: "error", messageKey: "focus.errors.no-task" };
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
    return { status: "error", messageKey: "focus.errors.duration" };
  }

  const supabase = await createClient();

  // Creation is server-side only: started_at, status and the owner are
  // stamped by the database function, never by the browser. Ownership of
  // the task and the one-open-session rule are checked inside the same
  // transaction, so there is no read-then-write gap here.
  const { data, error } = await callRpc<{ id: string }>(
    supabase,
    "start_focus_session",
    {
      p_task_id: taskId,
      p_planned_seconds: plannedSecondsFromMinutes(minutes),
    }
  );

  if (error) {
    const lowered = error.toLowerCase();
    if (lowered.includes("session_already_active")) {
      return { status: "error", messageKey: "focus.errors.active-session" };
    }
    if (lowered.includes("task_not_found_or_forbidden")) {
      return { status: "error", messageKey: "errors.forbidden" };
    }
    return dbFailure(error);
  }
  if (!data) return dbFailure("focus session creation failed");

  focusPaths();
  return success(data.id);
}

export async function pauseSessionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUserId();
  const id = formString(formData.get("id"));
  const supabase = await createClient();

  const { error } = await callRpc(supabase, "pause_focus_session", { p_session: id });
  if (error) return mapTimerError(error);

  focusPaths();
  return success(id);
}

export async function resumeSessionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUserId();
  const id = formString(formData.get("id"));
  const supabase = await createClient();

  const { error } = await callRpc(supabase, "resume_focus_session", { p_session: id });
  if (error) return mapTimerError(error);

  focusPaths();
  return success(id);
}

export async function recordInterruptionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUserId();
  const id = formString(formData.get("id"));
  const supabase = await createClient();

  const { error } = await callRpc<number>(supabase, "increment_focus_interruptions", {
    p_session: id,
  });
  if (error) return mapTimerError(error);

  focusPaths();
  return success(id);
}

export async function endSessionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUserId();
  const id = formString(formData.get("id"));
  const cancel = formString(formData.get("cancel")) === "true";
  const notes = formString(formData.get("notes"));

  const supabase = await createClient();
  const { error } = await callRpc(supabase, "end_focus_session", {
    p_session: id,
    p_cancel: cancel,
    p_notes: notes || null,
  });
  if (error) return mapTimerError(error);

  focusPaths();
  return { status: "success", id };
}

export async function saveSessionNoteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const notes = formString(formData.get("notes"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("focus_sessions")
    .update({ notes })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  focusPaths();
  return success(id);
}
