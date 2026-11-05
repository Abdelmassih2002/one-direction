import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { intlLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/types/models";
import { addDaysToKey, toDateKey } from "./date-keys";

/** Local calendar key (YYYY-MM-DD) for a UTC instant in the user's timezone. */
export function localDateKey(instant: Date | string, timeZone: string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

export function todayKey(timeZone: string, now: Date = new Date()): string {
  return localDateKey(now, timeZone);
}

export function tomorrowKey(timeZone: string, now: Date = new Date()): string {
  return addDaysToKey(todayKey(timeZone, now), 1);
}

/** Converts a `date` + `HH:mm` pair in the user's timezone to a UTC ISO string. */
export function localInputToIso(
  dateKey: string,
  time: string,
  timeZone: string
): string {
  const value = `${dateKey}T${time.length === 5 ? `${time}:00` : time}`;
  return fromZonedTime(value, timeZone).toISOString();
}

export function isoToLocalTime(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, "HH:mm");
}

export function isoToLocalDate(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, "yyyy-MM-dd");
}

export function formatInstant(
  iso: string,
  timeZone: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      ...options,
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Formats a date-only key without shifting it across timezones. */
export function formatDateKey(
  dateKey: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
): string {
  const safe = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...options,
    timeZone: "UTC",
  }).format(safe);
}

export function formatTimeRange(
  startIso: string,
  endIso: string,
  timeZone: string,
  locale: Locale
): string {
  const formatter = new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  return `${formatter.format(new Date(startIso))} – ${formatter.format(new Date(endIso))}`;
}

export function startOfLocalDayIso(dateKey: string, timeZone: string): string {
  return localInputToIso(dateKey, "00:00", timeZone);
}

export function endOfLocalDayIso(dateKey: string, timeZone: string): string {
  return localInputToIso(addDaysToKey(dateKey, 1), "00:00", timeZone);
}

export function greetingKey(hour: number): "today.greeting.morning" | "today.greeting.afternoon" | "today.greeting.evening" {
  if (hour < 12) return "today.greeting.morning";
  if (hour < 18) return "today.greeting.afternoon";
  return "today.greeting.evening";
}

/**
 * F-10: next quarter-hour slot in the user's timezone, as HH:mm. The old
 * default used getUTCHours() and suggested the wrong local time.
 */
export function nextQuarterHourLocal(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const rounded = Math.min(23 * 60 + 45, Math.ceil((hour * 60 + minute) / 15) * 15);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(rounded / 60))}:${pad(rounded % 60)}`;
}

export function currentHour(timeZone: string): number {
  return Number(formatInTimeZone(new Date(), timeZone, "H"));
}

export function dateKeyFromDate(date: Date): string {
  return toDateKey(date);
}
