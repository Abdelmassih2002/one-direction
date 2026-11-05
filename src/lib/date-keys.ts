import type { WeekStart } from "@/lib/types/models";

export const WEEK_START_DAYS: Record<WeekStart, 0 | 1 | 6> = {
  monday: 1,
  sunday: 0,
  saturday: 6,
};

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds whole days to a `YYYY-MM-DD` key without timezone drift. */
export function addDaysToKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function diffInDays(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000
  );
}

/** First day of the week containing `dateKey`, honouring the profile setting. */
export function weekStartFor(dateKey: string, weekStart: WeekStart): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const target = WEEK_START_DAYS[weekStart];
  const current = date.getUTCDay();
  const delta = (current - target + 7) % 7;
  return addDaysToKey(dateKey, -delta);
}

export function weekDays(weekStartKey: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysToKey(weekStartKey, index));
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

export const TIMEZONES = [
  "UTC",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Algiers",
  "Africa/Tunis",
  "Africa/Khartoum",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Asia/Bahrain",
  "Asia/Amman",
  "Asia/Beirut",
  "Asia/Baghdad",
  "Asia/Muscat",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Asia/Singapore",
  "Asia/Tokyo",
] as const;

export function formatTimeZoneLabel(timeZone: string): string {
  return timeZone.replace(/_/g, " ");
}
