import { describe, expect, it } from "vitest";
import {
  MAX_TOP_PRIORITIES,
  automaticRescheduleDecision,
  bucketTodayTasks,
  canMarkTopPriority,
  canNestSubtask,
  completionPercent,
  sortTasks,
} from "@/lib/domain/tasks";
import type { Task } from "@/lib/types/models";

function task(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? "t1",
    owner_id: "owner",
    goal_id: null,
    project_id: null,
    milestone_id: null,
    parent_task_id: null,
    title: overrides.title ?? "Task",
    description: null,
    status: overrides.status ?? "todo",
    estimate_minutes: null,
    scheduled_for: overrides.scheduled_for ?? null,
    due_at: overrides.due_at ?? null,
    completed_at: overrides.completed_at ?? null,
    sort_order: overrides.sort_order ?? 0,
    is_top_priority: overrides.is_top_priority ?? false,
    archived_at: null,
    created_at: overrides.created_at ?? "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("task rules (TASK-03/07/08)", () => {
  it("limits top priorities to three", () => {
    expect(MAX_TOP_PRIORITIES).toBe(3);
    expect(canMarkTopPriority(2)).toBe(true);
    expect(canMarkTopPriority(3)).toBe(false);
  });

  it("caps subtask nesting at two levels", () => {
    expect(canNestSubtask(0)).toBe(true);
    expect(canNestSubtask(1)).toBe(true);
    expect(canNestSubtask(2)).toBe(false);
  });

  it("never reschedules automatically", () => {
    expect(automaticRescheduleDecision()).toBeNull();
  });

  it("buckets today's tasks without moving anything", () => {
    const today = "2026-11-04";
    const tasks = [
      task({ id: "a", is_top_priority: true, scheduled_for: today }),
      task({ id: "b", scheduled_for: today }),
      task({ id: "c", status: "inbox" }),
      task({ id: "d", due_at: "2026-11-01T10:00:00.000Z" }),
      task({ id: "e", status: "done", completed_at: "2026-11-04T09:00:00.000Z" }),
      task({ id: "f", is_top_priority: true, scheduled_for: "2026-11-05" }),
    ];

    const buckets = bucketTodayTasks(tasks, today, (iso) => iso.slice(0, 10));
    expect(buckets.topPriorities.map((item) => item.id)).toEqual(["a"]);
    expect(buckets.scheduled.map((item) => item.id)).toEqual(["b"]);
    expect(buckets.inbox.map((item) => item.id)).toEqual(["c"]);
    expect(buckets.overdue.map((item) => item.id)).toEqual(["d"]);
    expect(buckets.completed.map((item) => item.id)).toEqual(["e"]);
    // Tomorrow's priority stays in tomorrow's plan.
    expect(buckets.scheduled.some((item) => item.id === "f")).toBe(false);
  });

  it("sorts priorities first, then explicit order", () => {
    const sorted = [
      task({ id: "1", sort_order: 1 }),
      task({ id: "2", is_top_priority: true, sort_order: 5 }),
      task({ id: "3", sort_order: 0 }),
    ].sort(sortTasks);
    expect(sorted.map((item) => item.id)).toEqual(["2", "3", "1"]);
  });

  it("computes completion percentage ignoring cancelled tasks", () => {
    expect(completionPercent([])).toBe(0);
    expect(
      completionPercent([{ status: "done" }, { status: "todo" }, { status: "cancelled" }])
    ).toBe(50);
  });
});
