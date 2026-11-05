import { z } from "zod";

export const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
export const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "invalid_email");

export const passwordSchema = z.string().min(8).max(200);

export const idSchema = z.string().regex(UUID, "invalid_id");

export const dateKeySchema = z.string().regex(DATE_KEY, "invalid_date");

export const optionalDateKey = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  dateKeySchema.optional()
);

export const optionalTimestamp = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().datetime({ offset: true }).optional()
);

export const optionalUuid = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  idSchema.optional()
);

export const text = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

/** Form helpers: every form field arrives as string | null | undefined. */
export function formString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function formStrings(value: FormDataEntryValue[]): string[] {
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function emptyToUndefined(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}
