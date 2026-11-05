import type {
  DailyReview,
  FocusCycle,
  FocusCycleGoal,
  FocusSession,
  Goal,
  LifeArea,
  Milestone,
  Profile,
  Project,
  ScheduleBlock,
  Task,
  WeeklyReview,
} from "./models";

type Row = Record<string, unknown>;

type TableDef<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

// Minimal hand-maintained binding for supabase-js (schema in migrations/*.sql).
// Keeping Insert/Update permissive here mirrors PostgREST defaults; every
// mutation is additionally validated with Zod on the server.
export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      life_areas: TableDef<LifeArea>;
      goals: TableDef<Goal>;
      focus_cycles: TableDef<FocusCycle>;
      focus_cycle_goals: TableDef<FocusCycleGoal>;
      projects: TableDef<Project>;
      milestones: TableDef<Milestone>;
      tasks: TableDef<Task>;
      schedule_blocks: TableDef<ScheduleBlock>;
      focus_sessions: TableDef<FocusSession>;
      daily_reviews: TableDef<DailyReview>;
      weekly_reviews: TableDef<WeeklyReview>;
    };
    Views: Record<string, never>;
    Functions: {
      delete_own_account: { Args: Row; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
