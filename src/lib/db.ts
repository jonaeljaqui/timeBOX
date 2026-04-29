import Database from "@tauri-apps/plugin-sql";
import type {
  Category,
  DailyPlan,
  ID,
  Settings,
  Task,
  Timebox,
  TimeboxStatus,
} from "./types";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load("sqlite:timebox.db");
  return dbPromise;
}

// ---------- Categories ----------

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category[]>(
    `SELECT id, name, color, sort_order FROM categories ORDER BY sort_order ASC`
  );
}

// ---------- Tasks (Inbox) ----------

export async function listTasks(opts?: {
  status?: Task["status"] | "active";
  category_id?: ID | null;
}): Promise<Task[]> {
  const db = await getDb();
  const where: string[] = [];
  const args: unknown[] = [];

  if (opts?.status === "active") {
    where.push(`status IN ('inbox','scheduled')`);
  } else if (opts?.status) {
    where.push(`status = ?`);
    args.push(opts.status);
  }
  if (opts?.category_id !== undefined) {
    if (opts.category_id === null) {
      where.push(`category_id IS NULL`);
    } else {
      where.push(`category_id = ?`);
      args.push(opts.category_id);
    }
  }

  const sql =
    `SELECT * FROM tasks` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY priority DESC, created_at DESC`;
  return db.select<Task[]>(sql, args);
}

export async function createTask(input: {
  title: string;
  notes?: string | null;
  category_id?: ID | null;
  estimated_min?: number | null;
  priority?: number;
}): Promise<Task> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO tasks (title, notes, category_id, estimated_min, priority)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.title,
      input.notes ?? null,
      input.category_id ?? null,
      input.estimated_min ?? null,
      input.priority ?? 0,
    ]
  );
  const id = result.lastInsertId as number;
  const row = await db.select<Task[]>(`SELECT * FROM tasks WHERE id = ?`, [id]);
  return row[0];
}

export async function updateTask(id: ID, patch: Partial<Task>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id") continue;
    fields.push(`${k} = ?`);
    args.push(v);
  }
  if (!fields.length) return;
  args.push(id);
  await db.execute(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`, args);
}

export async function deleteTask(id: ID): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM tasks WHERE id = ?`, [id]);
}

// ---------- Timeboxes ----------

export async function listTimeboxes(opts?: {
  fromDate?: string;            // inclusive YYYY-MM-DD
  toDate?: string;              // exclusive YYYY-MM-DD
  status?: TimeboxStatus[];
}): Promise<Timebox[]> {
  const db = await getDb();
  const where: string[] = [];
  const args: unknown[] = [];

  if (opts?.fromDate) {
    where.push(`planned_start >= ?`);
    args.push(`${opts.fromDate}T00:00:00.000`);
  }
  if (opts?.toDate) {
    where.push(`planned_start < ?`);
    args.push(`${opts.toDate}T00:00:00.000`);
  }
  if (opts?.status?.length) {
    where.push(
      `status IN (${opts.status.map(() => "?").join(",")})`
    );
    args.push(...opts.status);
  }

  const sql =
    `SELECT * FROM timeboxes` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY planned_start ASC`;
  return db.select<Timebox[]>(sql, args);
}

export async function getActiveTimebox(): Promise<Timebox | null> {
  const db = await getDb();
  const rows = await db.select<Timebox[]>(
    `SELECT * FROM timeboxes WHERE status = 'active' LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function createTimebox(input: {
  task_id: ID | null;
  title: string;
  category_id: ID | null;
  planned_start: string;
  planned_minutes: number;
  deliverable?: string | null;
  is_mit?: boolean;
}): Promise<Timebox> {
  const db = await getDb();
  // MIT is exclusive per day — demote any existing MIT for the same date.
  if (input.is_mit) {
    const day = input.planned_start.slice(0, 10);
    await db.execute(
      `UPDATE timeboxes SET is_mit = 0
       WHERE is_mit = 1 AND substr(planned_start, 1, 10) = ?`,
      [day]
    );
  }
  const result = await db.execute(
    `INSERT INTO timeboxes
       (task_id, title, category_id, planned_start, planned_minutes,
        deliverable, is_mit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.task_id,
      input.title,
      input.category_id,
      input.planned_start,
      input.planned_minutes,
      input.deliverable ?? null,
      input.is_mit ? 1 : 0,
    ]
  );
  // If a task is being scheduled, mark it as 'scheduled'.
  if (input.task_id != null) {
    await db.execute(
      `UPDATE tasks SET status = 'scheduled' WHERE id = ? AND status = 'inbox'`,
      [input.task_id]
    );
  }
  const id = result.lastInsertId as number;
  const row = await db.select<Timebox[]>(
    `SELECT * FROM timeboxes WHERE id = ?`,
    [id]
  );
  return row[0];
}

export async function setMIT(id: ID, planDate: string): Promise<void> {
  const db = await getDb();
  // Demote others on this date, then promote this one.
  await db.execute(
    `UPDATE timeboxes SET is_mit = 0
     WHERE is_mit = 1 AND substr(planned_start, 1, 10) = ?`,
    [planDate]
  );
  await db.execute(`UPDATE timeboxes SET is_mit = 1 WHERE id = ?`, [id]);
}

export async function clearMIT(id: ID): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE timeboxes SET is_mit = 0 WHERE id = ?`, [id]);
}

export async function updateTimebox(
  id: ID,
  patch: Partial<Timebox>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id") continue;
    fields.push(`${k} = ?`);
    args.push(v);
  }
  if (!fields.length) return;
  args.push(id);
  await db.execute(
    `UPDATE timeboxes SET ${fields.join(", ")} WHERE id = ?`,
    args
  );
}

export async function deleteTimebox(id: ID): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM timeboxes WHERE id = ?`, [id]);
}

export async function markTimeboxActive(id: ID): Promise<void> {
  const db = await getDb();
  // Only one active at a time — demote any other active boxes to skipped.
  await db.execute(
    `UPDATE timeboxes SET status = 'skipped' WHERE status = 'active' AND id != ?`,
    [id]
  );
  await db.execute(
    `UPDATE timeboxes SET status = 'active', actual_start = ? WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

export async function completeTimebox(
  id: ID,
  payload: {
    output: string;
    feeling: number;
    next_step: string;
    interrupted: number;
  }
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE timeboxes
     SET status = 'done', actual_end = ?, output = ?, feeling = ?, next_step = ?, interrupted = ?
     WHERE id = ?`,
    [
      new Date().toISOString(),
      payload.output,
      payload.feeling,
      payload.next_step,
      payload.interrupted,
      id,
    ]
  );
  // If linked to a task, mark task done.
  await db.execute(
    `UPDATE tasks SET status = 'done', completed_at = ?
     WHERE id = (SELECT task_id FROM timeboxes WHERE id = ?) AND status != 'done'`,
    [new Date().toISOString(), id]
  );
}

// ---------- Daily plans ----------

export async function getOrCreateDailyPlan(date: string): Promise<DailyPlan> {
  const db = await getDb();
  const rows = await db.select<DailyPlan[]>(
    `SELECT * FROM daily_plans WHERE plan_date = ?`,
    [date]
  );
  if (rows[0]) return rows[0];
  await db.execute(
    `INSERT INTO daily_plans (plan_date, started_at) VALUES (?, ?)`,
    [date, new Date().toISOString()]
  );
  const created = await db.select<DailyPlan[]>(
    `SELECT * FROM daily_plans WHERE plan_date = ?`,
    [date]
  );
  return created[0];
}

export async function updateDailyPlan(
  id: ID,
  patch: Partial<DailyPlan>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id") continue;
    fields.push(`${k} = ?`);
    args.push(v);
  }
  if (!fields.length) return;
  args.push(id);
  await db.execute(
    `UPDATE daily_plans SET ${fields.join(", ")} WHERE id = ?`,
    args
  );
}

export interface EveningReview {
  best_action: string;
  main_obstacle: string;
  obstacle_response: string;
  keep_action: string;
  drop_action: string;
}

/** Submit the 5-question evening review and stamp completion time. */
export async function completeEveningReview(
  id: ID,
  review: EveningReview
): Promise<void> {
  await updateDailyPlan(id, {
    review_best_action: review.best_action,
    review_main_obstacle: review.main_obstacle,
    review_obstacle_response: review.obstacle_response,
    review_keep_action: review.keep_action,
    review_drop_action: review.drop_action,
    review_completed_at: new Date().toISOString(),
  });
}

/**
 * Streak = consecutive calendar days with `review_completed_at` set, counted
 * backward from today (or yesterday if today's review isn't done yet).
 * If today is Day N and yesterday wasn't reviewed, the streak is broken.
 */
export async function getStreak(today: string): Promise<{
  count: number;
  last_review_date: string | null;
}> {
  const db = await getDb();
  const rows = await db.select<{ plan_date: string }[]>(
    `SELECT plan_date FROM daily_plans
     WHERE review_completed_at IS NOT NULL
     ORDER BY plan_date DESC
     LIMIT 365`
  );
  if (rows.length === 0) return { count: 0, last_review_date: null };

  // Build a quick lookup, then walk back day-by-day.
  const set = new Set(rows.map((r) => r.plan_date));
  let cursor = today;
  let count = 0;

  // If today isn't reviewed yet, allow starting from yesterday so the streak
  // doesn't drop until "yesterday" also expires un-reviewed.
  if (!set.has(cursor)) {
    cursor = stepDate(cursor, -1);
    if (!set.has(cursor)) return { count: 0, last_review_date: rows[0].plan_date };
  }
  while (set.has(cursor)) {
    count += 1;
    cursor = stepDate(cursor, -1);
  }
  return { count, last_review_date: rows[0].plan_date };
}

function stepDate(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's MIT timebox (if any). */
export async function getTodayMIT(date: string): Promise<Timebox | null> {
  const db = await getDb();
  const rows = await db.select<Timebox[]>(
    `SELECT * FROM timeboxes
     WHERE is_mit = 1 AND substr(planned_start, 1, 10) = ?
     LIMIT 1`,
    [date]
  );
  return rows[0] ?? null;
}

// ---------- Settings ----------

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select<Settings[]>(`SELECT * FROM settings WHERE id = 1`);
  return rows[0];
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id") continue;
    fields.push(`${k} = ?`);
    args.push(v);
  }
  if (!fields.length) return;
  await db.execute(`UPDATE settings SET ${fields.join(", ")} WHERE id = 1`, args);
}

// ---------- Stats ----------

export interface CategoryStat {
  category_id: ID | null;
  name: string | null;
  color: string | null;
  minutes: number;
  boxes: number;
}

export async function statsByCategory(
  fromDate: string,
  toDate: string
): Promise<CategoryStat[]> {
  const db = await getDb();
  return db.select<CategoryStat[]>(
    `SELECT
        t.category_id   AS category_id,
        c.name          AS name,
        c.color         AS color,
        COALESCE(SUM(t.planned_minutes), 0) AS minutes,
        COUNT(t.id)     AS boxes
     FROM timeboxes t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.status = 'done' AND t.planned_start >= ? AND t.planned_start < ?
     GROUP BY t.category_id, c.name, c.color
     ORDER BY minutes DESC`,
    [`${fromDate}T00:00:00.000`, `${toDate}T00:00:00.000`]
  );
}
