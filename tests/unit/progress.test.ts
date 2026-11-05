import { describe, expect, it } from "vitest";
import {
  formatMinutes,
  goalDisplayProgress,
  milestoneProgress,
  taskProgress,
  weeklySummary,
} from "@/lib/domain/progress";

describe("progress aggregation (INS-01/02)", () => {
  it("computes task progress without cancelled tasks", () => {
    expect(taskProgress([{ status: "done" }, { status: "todo" }, { status: "cancelled" }])).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    });
    expect(taskProgress([]).percent).toBe(0);
  });

  it("computes milestone progress", () => {
    expect(milestoneProgress([{ status: "done" }, { status: "open" }])).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    });
  });

  it("clamps manual goal progress instead of recomputing it", () => {
    expect(goalDisplayProgress({ progress: 140 })).toBe(100);
    expect(goalDisplayProgress({ progress: -5 })).toBe(0);
    expect(goalDisplayProgress({ progress: 42.6 })).toBe(43);
  });

  it("summarizes a week from real records only", () => {
    const summary = weeklySummary({
      tasks: [{ status: "done", completed_at: "2026-11-03T10:00:00.000Z" }],
      sessions: [
        { status: "completed", actual_seconds: 1500 },
        { status: "cancelled", actual_seconds: 300 },
        { status: "completed", actual_seconds: 900 },
      ],
      reviews: 1,
    });
    expect(summary).toEqual({
      tasksCompleted: 1,
      focusSeconds: 2400,
      focusSessions: 2,
      reviewsWritten: 1,
      documentedProgress: true,
    });
  });

  it("reports no documented progress for an empty week", () => {
    expect(
      weeklySummary({ tasks: [], sessions: [], reviews: 0 }).documentedProgress
    ).toBe(false);
  });

  it("formats focus minutes in both locales", () => {
    expect(formatMinutes(1500, "en")).toBe("25 min");
    expect(formatMinutes(5400, "en")).toBe("1h 30m");
    expect(formatMinutes(1500, "ar")).toContain("دقيقة");
  });
});
