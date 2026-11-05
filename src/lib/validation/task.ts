import { z } from "zod";
import { optionalUuid } from "./common";

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((value) => (value ? value : undefined)),
  status: z.enum(["inbox", "todo", "in_progress", "done", "cancelled"]).default("inbox"),
  goalId: optionalUuid,
  projectId: optionalUuid,
  milestoneId: optionalUuid,
  parentTaskId: optionalUuid,
  estimateMinutes: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().min(1).max(10_000).optional()
  ),
  scheduledFor: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
  ),
  dueAt: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().datetime({ offset: true }).optional()
  ),
  isTopPriority: z.coerce.boolean().default(false),
});

export const quickTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
});

export const taskStatusSchema = z.object({
  status: z.enum(["inbox", "todo", "in_progress", "done", "cancelled"]),
});

export const taskRescheduleSchema = z.object({
  action: z.enum(["tomorrow", "date", "inbox", "cancel"]),
  scheduledFor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const taskReorderSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export const taskPrioritySchema = z.object({
  isTopPriority: z.coerce.boolean(),
});
