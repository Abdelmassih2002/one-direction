import { weekStartFor } from "@/lib/date-keys";
import type { WeekStart } from "@/lib/types/models";
export { todayKey } from "@/lib/time";

export function weekStartKeyForProfile(today: string, weekStart: WeekStart): string {
  return weekStartFor(today, weekStart);
}
