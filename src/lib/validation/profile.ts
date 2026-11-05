import { z } from "zod";
import { TIMEZONES } from "@/lib/date-keys";

const localeSchema = z.enum(["en", "ar"]);
const weekStartSchema = z.enum(["monday", "sunday", "saturday"]);
const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "invalid_timezone");

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  locale: localeSchema,
  timezone: timezoneSchema,
  weekStart: weekStartSchema,
});

export const onboardingPreferencesSchema = z.object({
  locale: localeSchema,
  timezone: timezoneSchema,
  weekStart: weekStartSchema,
  displayName: z.string().trim().max(120).optional(),
});

export { TIMEZONES };
