export type ID = number;

export interface Category {
  id: ID;
  name: string;
  color: string;
  sort_order: number;
}

export type TaskStatus = "inbox" | "scheduled" | "done" | "dropped";

export interface Task {
  id: ID;
  title: string;
  notes: string | null;
  category_id: ID | null;
  estimated_min: number | null;
  priority: number;
  status: TaskStatus;
  created_at: string;
  completed_at: string | null;
}

export type TimeboxStatus =
  | "planned"
  | "active"
  | "done"
  | "skipped"
  | "cancelled";

export interface Timebox {
  id: ID;
  task_id: ID | null;
  title: string;
  category_id: ID | null;
  planned_start: string;       // ISO 8601
  planned_minutes: number;
  actual_start: string | null;
  actual_end: string | null;
  status: TimeboxStatus;
  output: string | null;
  feeling: number | null;
  next_step: string | null;
  interrupted: number;
  created_at: string;
  // v2 additions
  is_mit: number;              // 0 | 1 — Most Important Task of the day
  deliverable: string | null;  // What this box should produce (filled at plan time)
}

export interface DailyPlan {
  id: ID;
  plan_date: string;       // YYYY-MM-DD
  started_at: string;
  completed_at: string | null;
  intention: string | null;
  boxes_planned: number;
  minutes_planned: number;
  // v2: structured evening review (5 questions)
  review_best_action: string | null;
  review_main_obstacle: string | null;
  review_obstacle_response: string | null;
  review_keep_action: string | null;
  review_drop_action: string | null;
  review_completed_at: string | null;
}

export interface Settings {
  id: 1;
  work_day_start: string;          // HH:MM
  work_day_end: string;
  default_box_minutes: number;
  overrun_warn_minutes: number;
  daily_plan_reminder_at: string;
  streak_count: number;
  last_streak_date: string | null;
}

export interface TimerSnapshot {
  timebox_id: number;
  title: string;
  category: string | null;
  planned_minutes: number;
  started_at_ms: number;
  elapsed_secs: number;
  remaining_secs: number;
  overrun: boolean;
}
