import { describe, expect, it } from "vitest";
import {
  accumulatedOnPause,
  elapsedSeconds,
  finalDuration,
  formatClock,
  plannedSecondsFromMinutes,
  remainingSeconds,
  type SessionTimestamps,
} from "@/lib/domain/timer";

const base: SessionTimestamps = {
  startedAt: "2026-11-04T10:00:00.000Z",
  pausedAt: null,
  resumedAt: null,
  endedAt: null,
  accumulatedSeconds: 0,
  actualSeconds: null,
  status: "running",
};

const at = (iso: string) => Date.parse(iso);

describe("focus session timing (TIMER-03/05/06)", () => {
  it("derives elapsed time from timestamps, not a client counter", () => {
    const session = { ...base };
    expect(elapsedSeconds(session, at("2026-11-04T10:05:00.000Z"))).toBe(300);
    // Reloading the page later must show the same derived value.
    expect(elapsedSeconds(session, at("2026-11-04T10:10:00.000Z"))).toBe(600);
  });

  it("freezes elapsed time while paused", () => {
    const paused: SessionTimestamps = {
      ...base,
      status: "paused",
      accumulatedSeconds: 420,
      pausedAt: "2026-11-04T10:07:00.000Z",
    };
    expect(elapsedSeconds(paused, at("2026-11-04T10:30:00.000Z"))).toBe(420);
  });

  it("adds a resumed segment to the accumulated total", () => {
    const resumed: SessionTimestamps = {
      ...base,
      accumulatedSeconds: 420,
      resumedAt: "2026-11-04T10:20:00.000Z",
      status: "running",
    };
    expect(elapsedSeconds(resumed, at("2026-11-04T10:21:30.000Z"))).toBe(510);
  });

  it("computes the pause accumulator from the current segment", () => {
    expect(accumulatedOnPause({ ...base }, at("2026-11-04T10:02:00.000Z"))).toBe(120);
  });

  it("uses actual_seconds once a session is completed", () => {
    const completed: SessionTimestamps = {
      ...base,
      status: "completed",
      endedAt: "2026-11-04T10:30:00.000Z",
      actualSeconds: 1500,
    };
    expect(elapsedSeconds(completed, at("2026-11-04T11:00:00.000Z"))).toBe(1500);
    expect(finalDuration(completed, at("2026-11-04T11:00:00.000Z"))).toBe(1500);
  });

  it("never returns negative durations", () => {
    expect(elapsedSeconds(base, at("2026-11-04T09:59:00.000Z"))).toBe(0);
  });

  it("formats clocks and remaining time", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3661)).toBe("1:01:01");
    expect(remainingSeconds(300, 1500)).toBe(1200);
    expect(remainingSeconds(2000, 1500)).toBe(0);
  });

  it("converts planned minutes to seconds with a floor", () => {
    expect(plannedSecondsFromMinutes(25)).toBe(1500);
    expect(plannedSecondsFromMinutes(0)).toBe(60);
  });
});
