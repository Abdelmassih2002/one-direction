"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId, getCurrentProfile } from "@/lib/auth/session";
import { findOverlaps } from "@/lib/domain/schedule";
import { localInputToIso, todayKey } from "@/lib/time";
import { formString } from "@/lib/validation/common";
import { dbFailure, readBoolean, success, validationFailure } from "./helpers";
import { z } from "zod";
import type { ActionState } from "./types";

const blockSchema = z.object({
  blockType: z.enum(["focus", "rest", "personal", "commitment"]),
  title: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => (value ? value : undefined)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  taskId: z.string().uuid().optional(),
});

export async function createScheduleBlockAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = blockSchema.safeParse({
    blockType: formString(formData.get("blockType")) || "focus",
    title: formString(formData.get("title")) || undefined,
    date: formString(formData.get("date")) || todayKey("UTC"),
    startTime: formString(formData.get("startTime")),
    endTime: formString(formData.get("endTime")),
    taskId: formString(formData.get("taskId")) || undefined,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const profile = await getCurrentProfile();
  const timezone = profile?.timezone ?? "UTC";

  const startAt = localInputToIso(parsed.data.date, parsed.data.startTime, timezone);
  const endAt = localInputToIso(parsed.data.date, parsed.data.endTime, timezone);
  if (Date.parse(endAt) <= Date.parse(startAt)) {
    return { status: "error", messageKey: "errors.invalid-input" };
  }

  const confirmOverlap = readBoolean(formData.get("confirmOverlap"));
  const supabase = await createClient();

  // F-01: friendly ownership check. The composite FK is the real guarantee.
  if (parsed.data.taskId) {
    const { data: ownedTask, error: taskError } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", parsed.data.taskId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (taskError) return dbFailure(taskError.message);
    if (!ownedTask) return { status: "error", messageKey: "errors.forbidden" };
  }

  if (!confirmOverlap) {
    const { data: sameDay } = await supabase
      .from("schedule_blocks")
      .select("id, start_at, end_at")
      .eq("owner_id", userId)
      .gte("start_at", localInputToIso(parsed.data.date, "00:00", timezone))
      .lt("start_at", localInputToIso(parsed.data.date, "23:59", timezone));

    const overlaps = findOverlaps({ start_at: startAt, end_at: endAt }, sameDay ?? []);
    if (overlaps.length > 0) {
      return { status: "error", messageKey: "today.overlap-warning" };
    }
  }

  const { data, error } = await supabase
    .from("schedule_blocks")
    .insert({
      owner_id: userId,
      task_id: parsed.data.taskId ?? null,
      block_type: parsed.data.blockType,
      title: parsed.data.title ?? null,
      start_at: startAt,
      end_at: endAt,
    })
    .select("id")
    .single();
  if (error) return dbFailure(error.message);

  revalidatePath("/app/today");
  return success(data.id);
}

export async function deleteScheduleBlockAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const id = formString(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_blocks")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return dbFailure(error.message);

  revalidatePath("/app/today");
  return success(id);
}
