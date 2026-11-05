"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { validateCycleSetup } from "@/lib/domain/cycle";
import { formString } from "@/lib/validation/common";
import { cycleCloseSchema, cycleGoalsSchema, cycleSchema } from "@/lib/validation/cycle";
import { callRpc } from "@/lib/supabase/rpc";
import { dbFailure, readBoolean, readList, success, validationFailure } from "./helpers";
import type { ActionState } from "./types";

function cyclePaths() {
  revalidatePath("/app/focus-cycle");
  revalidatePath("/app/today");
  revalidatePath("/app/reviews");
  revalidatePath("/app/insights");
}

/**
 * Database errors are the authoritative rule violations (F-02/F-04). The UI
 * pre-validates for speed, but the transaction decides.
 */
function mapCycleDbError(message: string): ActionState {
  const value = message.toLowerCase();
  if (value.includes("active_cycle_exists")) {
    return { status: "error", messageKey: "cycle.errors.active-exists" };
  }
  if (value.includes("cycle_secondary_limit") || value.includes("secondary_limit")) {
    return { status: "error", messageKey: "cycle.errors.secondary-limit" };
  }
  if (value.includes("cycle_primary_required") || value.includes("primary_required")) {
    return { status: "error", messageKey: "cycle.errors.primary" };
  }
  if (value.includes("duplicate_goal")) {
    return { status: "error", messageKey: "cycle.errors.duplicate" };
  }
  if (value.includes("goal_not_found")) {
    return { status: "error", messageKey: "errors.forbidden" };
  }
  if (value.includes("cycle_not_found")) {
    return { status: "error", messageKey: "errors.not-found" };
  }
  if (value.includes("invalid_duration")) {
    return { status: "error", messageKey: "cycle.errors.duration" };
  }
  return dbFailure(message);
}

export async function createCycleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUserId();
  const parsed = cycleSchema.safeParse({
    title: formString(formData.get("title")) || undefined,
    durationWeeks: formString(formData.get("durationWeeks")) || 4,
    startDate: formString(formData.get("startDate")),
    primaryGoalId: formString(formData.get("primaryGoalId")),
    secondaryGoalIds: readList(formData, "secondaryGoalIds"),
    maintenanceGoalIds: readList(formData, "maintenanceGoalIds"),
    secondaryOverride: readBoolean(formData.get("secondaryOverride")),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const setup = validateCycleSetup({
    durationWeeks: parsed.data.durationWeeks,
    primaryGoalId: parsed.data.primaryGoalId,
    secondaryGoalIds: parsed.data.secondaryGoalIds,
    maintenanceGoalIds: parsed.data.maintenanceGoalIds,
    secondaryOverride: parsed.data.secondaryOverride,
  });
  if (!setup.ok) {
    if (setup.issues.includes("primary_required")) {
      return { status: "error", messageKey: "cycle.errors.primary" };
    }
    if (setup.issues.includes("secondary_limit")) {
      return { status: "error", messageKey: "cycle.errors.secondary-limit" };
    }
    if (setup.issues.includes("duplicate_goal")) {
      return { status: "error", messageKey: "cycle.errors.duplicate" };
    }
    return { status: "error", messageKey: "cycle.errors.duration" };
  }

  const supabase = await createClient();
  const { data, error } = await callRpc<string>(supabase, "create_focus_cycle", {
    p_title: parsed.data.title ?? null,
    p_start_date: parsed.data.startDate,
    p_duration_weeks: parsed.data.durationWeeks,
    p_primary: parsed.data.primaryGoalId,
    p_secondary: parsed.data.secondaryGoalIds,
    p_maintenance: parsed.data.maintenanceGoalIds,
    p_secondary_override: parsed.data.secondaryOverride,
  });
  if (error) return mapCycleDbError(error);
  if (!data) return dbFailure("missing_cycle_id");

  cyclePaths();
  return success(data);
}

export async function updateCycleGoalsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUserId();
  const cycleId = formString(formData.get("cycleId"));
  const parsed = cycleGoalsSchema.safeParse({
    primaryGoalId: formString(formData.get("primaryGoalId")),
    secondaryGoalIds: readList(formData, "secondaryGoalIds"),
    maintenanceGoalIds: readList(formData, "maintenanceGoalIds"),
    secondaryOverride: readBoolean(formData.get("secondaryOverride")),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const setup = validateCycleSetup({
    durationWeeks: 4,
    primaryGoalId: parsed.data.primaryGoalId,
    secondaryGoalIds: parsed.data.secondaryGoalIds,
    maintenanceGoalIds: parsed.data.maintenanceGoalIds,
    secondaryOverride: parsed.data.secondaryOverride,
  });
  if (!setup.ok) {
    if (setup.issues.includes("secondary_limit")) {
      return { status: "error", messageKey: "cycle.errors.secondary-limit" };
    }
    if (setup.issues.includes("primary_required")) {
      return { status: "error", messageKey: "cycle.errors.primary" };
    }
    return { status: "error", messageKey: "cycle.errors.duplicate" };
  }

  const supabase = await createClient();
  const { error } = await callRpc<void>(supabase, "set_cycle_goal_assignments", {
    p_cycle_id: cycleId,
    p_primary: parsed.data.primaryGoalId,
    p_secondary: parsed.data.secondaryGoalIds,
    p_maintenance: parsed.data.maintenanceGoalIds,
    p_secondary_override: parsed.data.secondaryOverride,
  });
  if (error) return mapCycleDbError(error);

  cyclePaths();
  return success(cycleId);
}

export async function closeCycleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const cycleId = formString(formData.get("cycleId"));
  const parsed = cycleCloseSchema.safeParse({
    outcome: formString(formData.get("outcome")),
    outcomeNotes: formString(formData.get("outcomeNotes")) || undefined,
  });
  if (!parsed.success) {
    return { status: "error", messageKey: "cycle.errors.outcome" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("focus_cycles")
    .update({
      active: false,
      outcome: parsed.data.outcome,
      outcome_notes: parsed.data.outcomeNotes ?? null,
    })
    .eq("id", cycleId)
    .eq("owner_id", userId)
    .eq("active", true)
    .select("id")
    .maybeSingle();
  if (error) return dbFailure(error.message);
  if (!data) return { status: "error", messageKey: "errors.not-found" };

  cyclePaths();
  return success(cycleId);
}
