import { z } from "zod";
import { optionalUuid } from "./common";

export const lifeAreaSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "invalid_color")
    .optional(),
  icon: z.string().trim().max(40).optional(),
});

export const lifeAreaOrderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const goalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((value) => (value ? value : undefined)),
  metric: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined)),
  lifeAreaId: optionalUuid,
  status: z.enum(["planned", "active", "maintenance", "on_hold", "completed", "archived"]),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  progress: z.coerce.number().int().min(0).max(100).default(0),
});

export const goalProgressSchema = z.object({
  progress: z.coerce.number().int().min(0).max(100),
});
