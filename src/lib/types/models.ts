// Domain models mirrored from the SQL schema (migrations/001 + 002).
// Timestamps are ISO strings (UTC) as returned by PostgREST.

export type Locale = "en" | "ar";
export type WeekStart = "monday" | "sunday" | "saturday";

export type Profile = {
  id: string;
  display_name: string | null;
  locale: Locale;
  timezone: string;
  week_start: WeekStart;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LifeArea = {
  id: string;
  owner_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalStatus =
  | "planned"
  | "active"
  | "maintenance"
  | "on_hold"
  | "completed"
  | "archived";

export type Goal = {
  id: string;
  owner_id: string;
  life_area_id: string | null;
  title: string;
  description: string | null;
  metric: string | null;
  status: GoalStatus;
  progress: number;
  target_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CycleOutcome = "achieved" | "progress" | "direction_change" | "paused";

export type FocusCycle = {
  id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  duration_weeks: number;
  active: boolean;
  title: string | null;
  reflection: string | null;
  outcome: CycleOutcome | null;
  outcome_notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CycleGoalRole = "primary" | "secondary" | "maintenance";

export type FocusCycleGoal = {
  id: string;
  owner_id: string;
  cycle_id: string;
  goal_id: string;
  role: CycleGoalRole;
  created_at: string;
  updated_at: string;
};

export type ProjectStatus = "planned" | "active" | "on_hold" | "completed" | "archived";

export type Project = {
  id: string;
  owner_id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  starts_on: string | null;
  due_on: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Milestone = {
  id: string;
  owner_id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_on: string | null;
  status: "open" | "done";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TaskStatus = "inbox" | "todo" | "in_progress" | "done" | "cancelled";

export type Task = {
  id: string;
  owner_id: string;
  goal_id: string | null;
  project_id: string | null;
  milestone_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  estimate_minutes: number | null;
  scheduled_for: string | null;
  due_at: string | null;
  completed_at: string | null;
  sort_order: number;
  is_top_priority: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlockType = "focus" | "rest" | "personal" | "commitment";

export type ScheduleBlock = {
  id: string;
  owner_id: string;
  task_id: string | null;
  block_type: BlockType;
  title: string | null;
  start_at: string;
  end_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionStatus = "running" | "paused" | "completed" | "cancelled";

export type FocusSession = {
  id: string;
  owner_id: string;
  task_id: string | null;
  started_at: string;
  paused_at: string | null;
  resumed_at: string | null;
  ended_at: string | null;
  planned_seconds: number;
  accumulated_seconds: number;
  actual_seconds: number | null;
  status: SessionStatus;
  interruptions: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyReview = {
  id: string;
  owner_id: string;
  review_date: string;
  wins: string | null;
  blockers: string | null;
  next_step: string | null;
  gratitude: string | null;
  energy_level: number | null;
  created_at: string;
  updated_at: string;
};

export type WeeklyReview = {
  id: string;
  owner_id: string;
  week_start: string;
  highlights: string | null;
  obstacles: string | null;
  learnings: string | null;
  next_week_focus: string | null;
  keep_focus: boolean | null;
  created_at: string;
  updated_at: string;
};

/** Cycle goal joined with its goal and life area, used by cycle views. */
export type CycleGoalWithGoal = FocusCycleGoal & {
  goal: Goal | null;
};
