import { describe, expect, it } from "vitest";
import { addDaysToKey, diffInDays, isValidDateKey, weekDays, weekStartFor } from "@/lib/date-keys";

describe("date keys and week start (I18N-03)", () => {
  it("adds days across month boundaries without timezone drift", () => {
    expect(addDaysToKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffInDays("2026-11-10", "2026-11-01")).toBe(9);
  });

  it("honours the profile week start", () => {
    // 2026-11-04 is a Wednesday.
    expect(weekStartFor("2026-11-04", "monday")).toBe("2026-11-02");
    expect(weekStartFor("2026-11-04", "sunday")).toBe("2026-11-01");
    expect(weekStartFor("2026-11-04", "saturday")).toBe("2026-10-31");
    // A Monday is its own week start.
    expect(weekStartFor("2026-11-02", "monday")).toBe("2026-11-02");
  });

  it("lists seven consecutive days", () => {
    expect(weekDays("2026-11-02")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("validates calendar keys strictly", () => {
    expect(isValidDateKey("2026-11-04")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("04-11-2026")).toBe(false);
  });
});
