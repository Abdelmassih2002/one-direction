"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { formString } from "@/lib/validation/common";
import { onboardingPreferencesSchema, profileSchema } from "@/lib/validation/profile";
import { callRpc } from "@/lib/supabase/rpc";
import { dbFailure, failure, success, validationFailure } from "./helpers";
import type { ActionState } from "./types";

async function persistLocaleCookie(locale: "en" | "ar") {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function saveOnboardingPreferencesAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = onboardingPreferencesSchema.safeParse({
    locale: formString(formData.get("locale")),
    timezone: formString(formData.get("timezone")),
    weekStart: formString(formData.get("weekStart")),
    displayName: formString(formData.get("displayName")) || undefined,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
      week_start: parsed.data.weekStart,
      ...(parsed.data.displayName ? { display_name: parsed.data.displayName } : {}),
    })
    .eq("id", userId);
  if (error) return dbFailure(error.message);

  await persistLocaleCookie(parsed.data.locale);
  revalidatePath("/", "layout");
  return success();
}

export async function completeOnboardingAction(): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId);
  redirect("/app/today");
}

/**
 * ONB-03/04 / F-06: goal, focus cycle, primary assignment and the onboarding
 * flag are written by one database function, so a partial failure leaves no
 * half-created goal or empty active cycle.
 */
export async function finishOnboardingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUserId();
  const title = formString(formData.get("goalTitle")).trim();
  const lifeAreaId = formString(formData.get("lifeAreaId"));
  const durationWeeks = Number(formString(formData.get("durationWeeks")) || 4);
  const startDate = formString(formData.get("startDate"));

  if (title.length > 200) return failure("onboarding.errors.title-required");

  const weeks =
    Number.isInteger(durationWeeks) && durationWeeks >= 2 && durationWeeks <= 6
      ? durationWeeks
      : 4;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? startDate
    : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { error } = await callRpc<string | null>(supabase, "finish_onboarding", {
    p_goal_title: title || null,
    p_life_area_id: lifeAreaId || null,
    p_start_date: start,
    p_duration_weeks: weeks,
  });
  if (error) return failure("onboarding.errors.goal");

  revalidatePath("/app/today");
  redirect("/app/today");
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = profileSchema.safeParse({
    displayName: formString(formData.get("displayName")),
    locale: formString(formData.get("locale")),
    timezone: formString(formData.get("timezone")),
    weekStart: formString(formData.get("weekStart")),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
      week_start: parsed.data.weekStart,
    })
    .eq("id", userId);
  if (error) return dbFailure(error.message);

  await persistLocaleCookie(parsed.data.locale);
  revalidatePath("/", "layout");
  return { status: "success", messageKey: "settings.saved" };
}

export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUserId();
  const confirmation = formString(formData.get("confirmation"));
  if (confirmation !== "DELETE") return failure("settings.delete-mismatch");

  const supabase = await createClient();
  // The RPC is SECURITY DEFINER and only ever deletes auth.uid()'s row;
  // every user table cascades from auth.users.
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return failure("settings.errors.delete");

  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(LOCALE_COOKIE);
  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}
