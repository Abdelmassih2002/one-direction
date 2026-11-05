import { describe, expect, it } from "vitest";
import { blockDurationSeconds, findOverlaps, overlaps, sortBlocks } from "@/lib/domain/schedule";

const block = (start: string, end: string, id = "b") => ({
  id,
  start_at: `2026-11-04T${start}:00.000Z`,
  end_at: `2026-11-04T${end}:00.000Z`,
});

describe("schedule overlap warning (PLAN-03)", () => {
  it("detects real overlaps only", () => {
    expect(overlaps(block("09:00", "10:00"), block("09:30", "10:30"))).toBe(true);
    expect(overlaps(block("09:00", "10:00"), block("10:00", "11:00"))).toBe(false);
    expect(overlaps(block("09:00", "10:00"), block("08:00", "09:00"))).toBe(false);
  });

  it("returns each overlapping block with its overlap size", () => {
    const conflicts = findOverlaps(block("09:00", "11:00"), [
      block("08:00", "09:30", "a"),
      block("12:00", "13:00", "b"),
      block("10:15", "10:45", "c"),
    ]);
    expect(conflicts.map((entry) => entry.block.id)).toEqual(["a", "c"]);
    expect(conflicts[0].overlapSeconds).toBe(1800);
    expect(conflicts[1].overlapSeconds).toBe(1800);
  });

  it("sorts blocks by start time and measures duration", () => {
    const sorted = sortBlocks([block("12:00", "13:00", "late"), block("08:00", "09:00", "early")]);
    expect(sorted[0].id).toBe("early");
    expect(blockDurationSeconds(block("08:00", "09:30"))).toBe(5400);
  });
});
