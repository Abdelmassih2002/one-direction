import { z } from "zod";
import { optionalUuid } from "./common";

export const projectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((value) => (value ? value : undefined)),
  goalId: optionalUuid,
  status: z.enum(["planned", "active", "on_hold", "completed", "archived"]),
  startsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const milestoneSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.enum(["open", "done"]).default("open"),
});
