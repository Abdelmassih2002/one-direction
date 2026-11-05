"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { formString } from "@/lib/validation/common";
import { z } from "zod";
import { dbFailure, validationFailure } from "./helpers";
import type { ActionState } from "./types";

const dailyReviewSchema = z.object({
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wins: z.string().trim().max(4000).optional(),
  blockers: z.string().trim().max(4000).optional(),
  nextStep: z.string().trim().max(4000).optional(),
  gratitude: z.string().trim().max(4000).optional(),
  energyLevel: z.preprocess(
    (value) => (value === "" || value === "0" || value === null ? undefined : value),
    z.coerce.number().int().min(1).max(5).optional()
  ),
});

const weeklyReviewSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  highlights: z.string().trim().max(6000).optional(),
  obstacles: z.string().trim().max(6000).optional(),
  learnings: z.string().trim().max(6000).optional(),
  nextWeekFocus: z.string().trim().max(4000).optional(),
  keepFocus: z.coerce.boolean().default(false),
});

function reviewPaths() {
  revalidatePath("/app/journal");
  revalidatePath("/app/reviews");
  revalidatePath("/app/insights");
}

export async function saveDailyReviewAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = dailyReviewSchema.safeParse({
    reviewDate: formString(formData.get("reviewDate")),
    wins: formString(formData.get("wins")) || undefined,
    blockers: formString(formData.get("blockers")) || undefined,
    nextStep: formString(formData.get("nextStep")) || undefined,
    gratitude: formString(formData.get("gratitude")) || undefined,
    energyLevel: formString(formData.get("energyLevel")) || undefined,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("daily_reviews").upsert(
    {
      owner_id: userId,
      review_date: parsed.data.reviewDate,
      wins: parsed.data.wins ?? null,
      blockers: parsed.data.blockers ?? null,
      next_step: parsed.data.nextStep ?? null,
      gratitude: parsed.data.gratitude ?? null,
      energy_level: parsed.data.energyLevel ?? null,
    },
    { onConflict: "owner_id,review_date" }
  );
  if (error) return dbFailure(error.message);

  reviewPaths();
  return { status: "success", messageKey: "journal.saved" };
}

export async function saveWeeklyReviewAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = weeklyReviewSchema.safeParse({
    weekStart: formString(formData.get("weekStart")),
    highlights: formString(formData.get("highlights")) || undefined,
    obstacles: formString(formData.get("obstacles")) || undefined,
    learnings: formString(formData.get("learnings")) || undefined,
    nextWeekFocus: formString(formData.get("nextWeekFocus")) || undefined,
    keepFocus: formData.get("keepFocus") === "on",
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("weekly_reviews").upsert(
    {
      owner_id: userId,
      week_start: parsed.data.weekStart,
      highlights: parsed.data.highlights ?? null,
      obstacles: parsed.data.obstacles ?? null,
      learnings: parsed.data.learnings ?? null,
      next_week_focus: parsed.data.nextWeekFocus ?? null,
      keep_focus: parsed.data.keepFocus,
    },
    { onConflict: "owner_id,week_start" }
  );
  if (error) return dbFailure(error.message);

  reviewPaths();
  return { status: "success", messageKey: "reviews.saved" };
}
