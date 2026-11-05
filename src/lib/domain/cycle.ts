import type { CycleGoalRole, CycleOutcome } from "@/lib/types/models";

export const CYCLE_MIN_WEEKS = 2;
export const CYCLE_MAX_WEEKS = 6;
export const CYCLE_DEFAULT_WEEKS = 4;
export const MAX_SECONDARY_GOALS = 2;

export type CycleSetupIssue =
  | "primary_required"
  | "secondary_limit"
  | "duplicate_goal"
  | "invalid_duration";

export function isValidCycleDuration(weeks: number): boolean {
  return Number.isInteger(weeks) && weeks >= CYCLE_MIN_WEEKS && weeks <= CYCLE_MAX_WEEKS;
}

/** A 4-week cycle starting Monday ends on the Sunday four weeks later. */
export function cycleEndDate(startDate: string, weeks: number): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + weeks * 7 - 1);
  return start.toISOString().slice(0, 10);
}

export function countCycleRoles(roles: CycleGoalRole[]) {
  return {
    primary: roles.filter((role) => role === "primary").length,
    secondary: roles.filter((role) => role === "secondary").length,
    maintenance: roles.filter((role) => role === "maintenance").length,
  };
}

export interface CycleSetupInput {
  durationWeeks: number;
  primaryGoalId: string | null;
  secondaryGoalIds: string[];
  maintenanceGoalIds: string[];
  /** The user explicitly accepted the "more than two secondary goals" warning. */
  secondaryOverride?: boolean;
}

/**
 * Domain rules FOCUSC-02/03/04:
 * - exactly one primary goal,
 * - two secondary goals recommended; more requires a conscious override,
 * - maintenance goals never count as primary/secondary.
 */
export function validateCycleSetup(input: CycleSetupInput): {
  ok: boolean;
  issues: CycleSetupIssue[];
} {
  const issues: CycleSetupIssue[] = [];

  if (!isValidCycleDuration(input.durationWeeks)) issues.push("invalid_duration");
  if (!input.primaryGoalId) issues.push("primary_required");

  const all = [
    input.primaryGoalId,
    ...input.secondaryGoalIds,
    ...input.maintenanceGoalIds,
  ].filter((id): id is string => Boolean(id));
  if (new Set(all).size !== all.length) issues.push("duplicate_goal");

  if (input.secondaryGoalIds.length > MAX_SECONDARY_GOALS && !input.secondaryOverride) {
    issues.push("secondary_limit");
  }

  return { ok: issues.length === 0, issues };
}

export const CYCLE_OUTCOMES: CycleOutcome[] = [
  "achieved",
  "progress",
  "direction_change",
  "paused",
];

export function isCycleCompleted(cycle: {
  active: boolean;
  outcome: CycleOutcome | null;
}): boolean {
  return !cycle.active && cycle.outcome !== null;
}
