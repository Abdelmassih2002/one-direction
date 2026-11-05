import type { SessionStatus } from "@/lib/types/models";

export interface SessionTimestamps {
  startedAt: string;
  pausedAt: string | null;
  resumedAt: string | null;
  endedAt: string | null;
  accumulatedSeconds: number;
  actualSeconds: number | null;
  status: SessionStatus;
}

/**
 * TIMER-05: elapsed time is derived from stored timestamps, never from a
 * client-side counter, so a reload or a second device shows the same value.
 */
export function elapsedSeconds(session: SessionTimestamps, nowMs: number): number {
  if (session.status === "completed" || session.status === "cancelled" || session.endedAt) {
    return Math.max(0, session.actualSeconds ?? session.accumulatedSeconds);
  }

  if (session.status === "paused") {
    return Math.max(0, session.accumulatedSeconds);
  }

  const segmentStart = Date.parse(session.resumedAt ?? session.startedAt);
  const segmentSeconds = Math.max(0, Math.floor((nowMs - segmentStart) / 1000));
  return Math.max(0, session.accumulatedSeconds + segmentSeconds);
}

/** Value to persist when pausing: freeze the current segment into the total. */
export function accumulatedOnPause(session: SessionTimestamps, nowMs: number): number {
  return elapsedSeconds({ ...session, status: "running", endedAt: null }, nowMs);
}

/** Value to persist when ending a session. */
export function finalDuration(session: SessionTimestamps, nowMs: number): number {
  if (session.status === "completed" || session.status === "cancelled" || session.endedAt) {
    return Math.max(0, session.actualSeconds ?? session.accumulatedSeconds);
  }
  if (session.status === "paused") return Math.max(0, session.accumulatedSeconds);
  return elapsedSeconds({ ...session, status: "running", endedAt: null }, nowMs);
}

export function remainingSeconds(elapsed: number, plannedSeconds: number): number {
  return Math.max(0, plannedSeconds - elapsed);
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${pad(minutes)}:${pad(rest)}`;
}

export const TIMER_PRESETS = [15, 25, 45, 60, 90] as const;
export const DEFAULT_PLANNED_MINUTES = 25;

export function plannedSecondsFromMinutes(minutes: number): number {
  return Math.max(60, Math.round(minutes * 60));
}
