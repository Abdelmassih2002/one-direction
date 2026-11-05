"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { formString } from "@/lib/validation/common";
import { lifeAreaSchema } from "@/lib/validation/goal";
import { dbFailure, readList, success, validationFailure } from "./helpers";
import type { ActionState } from "./types";

export async function createLifeAreaAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = lifeAreaSchema.safeParse({
    name: formString(formData.get("name")),
    color: formString(formData.get("color")) || undefined,
    icon: formString(formData.get("icon")) || undefined,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("life_areas")
    .select("sort_order")
    .eq("owner_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("life_areas")
    .insert({
      owner_id: userId,
      name: parsed.data.name,
      color: parsed.data.color ?? "#2563eb",
      icon: parsed.data.icon ?? null,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) return dbFailure(error.message);

  revalidatePath("/app/life");
  revalidatePath("/app/goals");
  return success(data.id);
}

export async function createLifeAreasBatchAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const names = readList(formData, "names")
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.length <= 80)
    .slice(0, 20);

  if (names.length === 0) return success();

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("life_areas")
    .select("sort_order")
    .eq("owner_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("life_areas").insert(
    names.map((name, index) => ({
      owner_id: userId,
      name,
      sort_order: base + index,
    }))
  );
  if (error) return dbFailure(error.message);

  revalidatePath("/app/life");
  return success();
}

export async function updateLifeAreaAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const parsed = lifeAreaSchema.safeParse({
    name: formString(formData.get("name")),
    color: formString(formData.get("color")) || undefined,
    icon: formString(formData.get("icon")) || undefined,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("life_areas")
    .update({
      name: parsed.data.name,
      color: parsed.data.color ?? "#2563eb",
      icon: parsed.data.icon ?? null,
    })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  revalidatePath("/app/life");
  return success(id);
}

export async function setLifeAreaArchivedAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const archived = formString(formData.get("archived")) === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("life_areas")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  revalidatePath("/app/life");
  revalidatePath("/app/goals");
  return success(id);
}

export async function reorderLifeAreaAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));
  const direction = formString(formData.get("direction"));

  const supabase = await createClient();
  const { data: areas, error } = await supabase
    .from("life_areas")
    .select("id, sort_order")
    .eq("owner_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error) return dbFailure(error.message);

  const index = areas?.findIndex((area) => area.id === id) ?? -1;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (!areas || index < 0 || swapWith < 0 || swapWith >= areas.length) return success(id);

  const current = areas[index];
  const neighbour = areas[swapWith];

  await supabase
    .from("life_areas")
    .update({ sort_order: neighbour.sort_order })
    .eq("id", current.id)
    .eq("owner_id", userId);
  await supabase
    .from("life_areas")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbour.id)
    .eq("owner_id", userId);

  revalidatePath("/app/life");
  return success(id);
}

export async function deleteLifeAreaAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));

  const supabase = await createClient();
  const { count } = await supabase
    .from("goals")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("life_area_id", id);

  if ((count ?? 0) > 0) {
    // LIFE-01: never cascade-delete goals. Archiving is the safe default.
    const { error } = await supabase
      .from("life_areas")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", userId);
    if (error) return dbFailure(error.message);
    revalidatePath("/app/life");
    return { status: "success", id, messageKey: "life.archive-body" };
  }

  const { error } = await supabase
    .from("life_areas")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  revalidatePath("/app/life");
  return success(id);
}
