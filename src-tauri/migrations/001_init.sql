-- timeBOX initial schema
-- Maps to the book's framework: 信念 → 计划 (待办清单/时间盒/日历) → 实践 (开启-执行-验收) → 掌控 (复盘)

CREATE TABLE IF NOT EXISTS categories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL UNIQUE,
    color        TEXT NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO categories (name, color, sort_order) VALUES
    ('学习',  '#4F8BFF', 1),
    ('创业',  '#F26B6B', 2),
    ('生活',  '#52C18E', 3),
    ('内务',  '#9CA3AF', 4);

-- Inbox / 待办清单 — first stop for any task before it gets boxed
CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    notes           TEXT,
    category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    estimated_min   INTEGER,                                -- user's first guess of duration
    priority        INTEGER NOT NULL DEFAULT 0,             -- 0=normal,1=high,-1=low
    status          TEXT NOT NULL DEFAULT 'inbox'           -- inbox | scheduled | done | dropped
        CHECK (status IN ('inbox','scheduled','done','dropped')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);

-- 时间盒 itself: a planned chunk of time for one task
CREATE TABLE IF NOT EXISTS timeboxes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id             INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,                      -- denormalized for history readability
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    planned_start       TEXT NOT NULL,                      -- ISO 8601
    planned_minutes     INTEGER NOT NULL,
    actual_start        TEXT,
    actual_end          TEXT,
    status              TEXT NOT NULL DEFAULT 'planned'     -- planned | active | done | skipped | cancelled
        CHECK (status IN ('planned','active','done','skipped','cancelled')),
    -- 验收 (Accept) fields, captured when the box ends
    output              TEXT,                               -- what came out of the box
    feeling             INTEGER,                            -- 1..5 self-rated focus/satisfaction
    next_step           TEXT,                               -- the immediate next action
    interrupted         INTEGER NOT NULL DEFAULT 0,         -- count of self-reported "rabbit hole" interruptions
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_tb_planned_start ON timeboxes(planned_start);
CREATE INDEX IF NOT EXISTS idx_tb_status        ON timeboxes(status);
CREATE INDEX IF NOT EXISTS idx_tb_category      ON timeboxes(category_id);
CREATE INDEX IF NOT EXISTS idx_tb_task          ON timeboxes(task_id);

-- 每日规划仪式 (Ch.9-13): record each 15-min planning session
CREATE TABLE IF NOT EXISTS daily_plans (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_date           TEXT NOT NULL UNIQUE,               -- YYYY-MM-DD local
    started_at          TEXT NOT NULL,
    completed_at        TEXT,
    intention           TEXT,                               -- one-line intention for the day
    boxes_planned       INTEGER NOT NULL DEFAULT 0,
    minutes_planned     INTEGER NOT NULL DEFAULT 0
);

-- App-wide settings (single row, id=1)
CREATE TABLE IF NOT EXISTS settings (
    id                          INTEGER PRIMARY KEY CHECK (id = 1),
    work_day_start              TEXT NOT NULL DEFAULT '08:00',
    work_day_end                TEXT NOT NULL DEFAULT '22:00',
    default_box_minutes         INTEGER NOT NULL DEFAULT 30,
    overrun_warn_minutes        INTEGER NOT NULL DEFAULT 5,   -- 兔子洞 alert (Ch.18)
    daily_plan_reminder_at      TEXT NOT NULL DEFAULT '08:30',
    streak_count                INTEGER NOT NULL DEFAULT 0,   -- consecutive days with a planning session (Ch.19)
    last_streak_date            TEXT
);

INSERT OR IGNORE INTO settings (id) VALUES (1);
