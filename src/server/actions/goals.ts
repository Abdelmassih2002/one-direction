"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { formString, optionalUuid } from "@/lib/validation/common";
import { goalProgressSchema, goalSchema } from "@/lib/validation/goal";
import { dbFailure, success, validationFailure } from "./helpers";
import type { GoalStatus } from "@/lib/types/models";
import type { ActionState } from "./types";

function goalPaths(id?: string) {
  revalidatePath("/app/goals");
  revalidatePath("/app/today");
  revalidatePath("/app/insights");
  revalidatePath("/app/focus-cycle");
  if (id) revalidatePath(`/app/goals/${id}`);
}

export async function createGoalAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = goalSchema.safeParse({
    title: formString(formData.get("title")),
    description: formString(formData.get("description")) || undefined,
    metric: formString(formData.get("metric")) || undefined,
    lifeAreaId: formString(formData.get("lifeAreaId")) || undefined,
    status: formString(formData.get("status")) || "planned",
    targetDate: formString(formData.get("targetDate")) || undefined,
    progress: formString(formData.get("progress")) || 0,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();

  // F-01: friendly check; the composite FK enforces it for direct API calls.
  if (parsed.data.lifeAreaId) {
    const { data: area, error: areaError } = await supabase
      .from("life_areas")
      .select("id")
      .eq("id", parsed.data.lifeAreaId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (areaError) return dbFailure(areaError.message);
    if (!area) return { status: "error", messageKey: "errors.forbidden" };
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({
      owner_id: userId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      metric: parsed.data.metric ?? null,
      life_area_id: parsed.data.lifeAreaId ?? null,
      status: parsed.data.status,
      target_date: parsed.data.targetDate ?? null,
      progress: parsed.data.progress,
    })
    .select("id")
    .single();
  if (error) return dbFailure(error.message);

  goalPaths(data.id);
  return success(data.id);
}

export async function updateGoalAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const parsed = goalSchema.safeParse({
    title: formString(formData.get("title")),
    description: formString(formData.get("description")) || undefined,
    metric: formString(formData.get("metric")) || undefined,
    lifeAreaId: optionalUuid.parse(formString(formData.get("lifeAreaId")) || undefined),
    status: formString(formData.get("status")) || "planned",
    targetDate: formString(formData.get("targetDate")) || undefined,
    progress: formString(formData.get("progress")) || 0,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();

  if (parsed.data.lifeAreaId) {
    const { data: area, error: areaError } = await supabase
      .from("life_areas")
      .select("id")
      .eq("id", parsed.data.lifeAreaId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (areaError) return dbFailure(areaError.message);
    if (!area) return { status: "error", messageKey: "errors.forbidden" };
  }

  const { error } = await supabase
    .from("goals")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      metric: parsed.data.metric ?? null,
      life_area_id: parsed.data.lifeAreaId ?? null,
      status: parsed.data.status,
      target_date: parsed.data.targetDate ?? null,
      progress: parsed.data.progress,
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  goalPaths(id);
  return success(id);
}

export async function updateGoalProgressAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const parsed = goalProgressSchema.safeParse({ progress: formString(formData.get("progress")) });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ progress: parsed.data.progress })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  goalPaths(id);
  return success(id);
}

export async function archiveGoalAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const archive = formString(formData.get("archive")) !== "false";

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      archived_at: archive ? new Date().toISOString() : null,
      status: archive ? "archived" : "planned",
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  goalPaths(id);
  return success(id);
}

export async function setGoalStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const status = formString(formData.get("status"));
  const allowed: GoalStatus[] = [
    "planned",
    "active",
    "maintenance",
    "on_hold",
    "completed",
    "archived",
  ];
  if (!allowed.includes(status as GoalStatus)) {
    return { status: "error", messageKey: "errors.invalid-input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      status: status as GoalStatus,
      archived_at: status === "archived" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  goalPaths(id);
  return success(id);
}
