"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { formString, optionalUuid } from "@/lib/validation/common";
import { milestoneSchema, projectSchema } from "@/lib/validation/project";
import { dbFailure, success, validationFailure } from "./helpers";
import type { ProjectStatus } from "@/lib/types/models";
import type { ActionState } from "./types";

function projectPaths(id?: string) {
  revalidatePath("/app/projects");
  revalidatePath("/app/today");
  if (id) revalidatePath(`/app/projects/${id}`);
}

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = projectSchema.safeParse({
    title: formString(formData.get("title")),
    description: formString(formData.get("description")) || undefined,
    goalId: optionalUuid.parse(formString(formData.get("goalId")) || undefined),
    status: formString(formData.get("status")) || "active",
    startsOn: formString(formData.get("startsOn")) || undefined,
    dueOn: formString(formData.get("dueOn")) || undefined,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: userId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      goal_id: parsed.data.goalId ?? null,
      status: parsed.data.status,
      starts_on: parsed.data.startsOn ?? null,
      due_on: parsed.data.dueOn ?? null,
    })
    .select("id")
    .single();
  if (error) return dbFailure(error.message);

  projectPaths(data.id);
  return success(data.id);
}

export async function updateProjectAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const parsed = projectSchema.safeParse({
    title: formString(formData.get("title")),
    description: formString(formData.get("description")) || undefined,
    goalId: optionalUuid.parse(formString(formData.get("goalId")) || undefined),
    status: formString(formData.get("status")) || "active",
    startsOn: formString(formData.get("startsOn")) || undefined,
    dueOn: formString(formData.get("dueOn")) || undefined,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      goal_id: parsed.data.goalId ?? null,
      status: parsed.data.status,
      starts_on: parsed.data.startsOn ?? null,
      due_on: parsed.data.dueOn ?? null,
      archived_at: parsed.data.status === "archived" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  projectPaths(id);
  return success(id);
}

export async function setProjectStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const status = formString(formData.get("status"));
  const allowed: ProjectStatus[] = ["planned", "active", "on_hold", "completed", "archived"];
  if (!allowed.includes(status as ProjectStatus)) {
    return { status: "error", messageKey: "errors.invalid-input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      status: status as ProjectStatus,
      archived_at: status === "archived" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  projectPaths(id);
  return success(id);
}

export async function addMilestoneAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = milestoneSchema.safeParse({
    projectId: formString(formData.get("projectId")),
    title: formString(formData.get("title")),
    dueOn: formString(formData.get("dueOn")) || undefined,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("milestones")
    .select("sort_order")
    .eq("owner_id", userId)
    .eq("project_id", parsed.data.projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("milestones")
    .insert({
      owner_id: userId,
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      due_on: parsed.data.dueOn ?? null,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) return dbFailure(error.message);

  projectPaths(parsed.data.projectId);
  return success(data.id);
}

export async function setMilestoneStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const status = formString(formData.get("status")) === "done" ? "done" : "open";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .update({ status })
    .eq("id", id)
    .eq("owner_id", userId)
    .select("project_id")
    .single();
  if (error) return dbFailure(error.message);

  projectPaths(data.project_id);
  return success(id);
}

export async function deleteMilestoneAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));

  const supabase = await createClient();
  const { data } = await supabase
    .from("milestones")
    .select("project_id")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("milestones")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  if (data?.project_id) projectPaths(data.project_id);
  return success(id);
}
