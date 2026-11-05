import { describe, expect, it } from "vitest";
import {
  countCycleRoles,
  cycleEndDate,
  isValidCycleDuration,
  validateCycleSetup,
} from "@/lib/domain/cycle";

const goal = (id: string) => id;

describe("focus cycle rules (FOCUSC-01..05)", () => {
  it("accepts 2..6 weeks and rejects everything else", () => {
    expect([2, 3, 4, 5, 6].every(isValidCycleDuration)).toBe(true);
    expect(isValidCycleDuration(1)).toBe(false);
    expect(isValidCycleDuration(7)).toBe(false);
    expect(isValidCycleDuration(3.5)).toBe(false);
  });

  it("computes an inclusive end date for a four week cycle", () => {
    expect(cycleEndDate("2026-11-02", 4)).toBe("2026-11-29");
    expect(cycleEndDate("2026-11-30", 2)).toBe("2026-12-13");
  });

  it("requires exactly one primary goal", () => {
    const result = validateCycleSetup({
      durationWeeks: 4,
      primaryGoalId: null,
      secondaryGoalIds: [],
      maintenanceGoalIds: [],
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("primary_required");
  });

  it("allows two secondary goals without an override", () => {
    expect(
      validateCycleSetup({
        durationWeeks: 4,
        primaryGoalId: goal("p"),
        secondaryGoalIds: ["s1", "s2"],
        maintenanceGoalIds: ["m1", "m2", "m3"],
      }).ok
    ).toBe(true);
  });

  it("requires a conscious override for a third secondary goal", () => {
    const withoutOverride = validateCycleSetup({
      durationWeeks: 4,
      primaryGoalId: goal("p"),
      secondaryGoalIds: ["s1", "s2", "s3"],
      maintenanceGoalIds: [],
    });
    expect(withoutOverride.ok).toBe(false);
    expect(withoutOverride.issues).toContain("secondary_limit");

    const withOverride = validateCycleSetup({
      durationWeeks: 4,
      primaryGoalId: goal("p"),
      secondaryGoalIds: ["s1", "s2", "s3"],
      maintenanceGoalIds: [],
      secondaryOverride: true,
    });
    expect(withOverride.ok).toBe(true);
  });

  it("rejects the same goal appearing twice", () => {
    const result = validateCycleSetup({
      durationWeeks: 4,
      primaryGoalId: "g1",
      secondaryGoalIds: ["g1"],
      maintenanceGoalIds: [],
    });
    expect(result.issues).toContain("duplicate_goal");
  });

  it("counts roles independently", () => {
    expect(countCycleRoles(["primary", "secondary", "secondary", "maintenance"])).toEqual({
      primary: 1,
      secondary: 2,
      maintenance: 1,
    });
  });
});
