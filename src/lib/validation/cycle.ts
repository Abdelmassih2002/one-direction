import { z } from "zod";
import { CYCLE_MAX_WEEKS, CYCLE_MIN_WEEKS } from "@/lib/domain/cycle";

export const cycleSchema = z.object({
  title: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => (value ? value : undefined)),
  durationWeeks: z.coerce
    .number()
    .int()
    .min(CYCLE_MIN_WEEKS)
    .max(CYCLE_MAX_WEEKS)
    .default(4),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  primaryGoalId: z.string().uuid(),
  secondaryGoalIds: z.array(z.string().uuid()).max(10).default([]),
  maintenanceGoalIds: z.array(z.string().uuid()).max(20).default([]),
  secondaryOverride: z.coerce.boolean().default(false),
});

export const cycleGoalsSchema = z.object({
  primaryGoalId: z.string().uuid(),
  secondaryGoalIds: z.array(z.string().uuid()).max(10).default([]),
  maintenanceGoalIds: z.array(z.string().uuid()).max(20).default([]),
  secondaryOverride: z.coerce.boolean().default(false),
});

export const cycleCloseSchema = z.object({
  outcome: z.enum(["achieved", "progress", "direction_change", "paused"]),
  outcomeNotes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((value) => (value ? value : undefined)),
});
