import { useEffect, useState } from "react";
import {
  createTimebox,
  listCategories,
  listTasks,
} from "../lib/db";
import type { Category, Task } from "../lib/types";
import { isoForLocalDateTime, todayISO } from "../lib/format";

const COMMON_DURATIONS = [15, 25, 30, 45, 60, 90];

export function StartBoxDialog({
  defaultDate,
  defaultStartTime,
  defaultMinutes,
  defaultTitle,
  defaultCategoryId,
  defaultDeliverable,
  defaultIsMit,
  titleHint,
  onCancel,
  onCreated,
}: {
  defaultDate?: string;
  defaultStartTime?: string;
  defaultMinutes?: number;
  defaultTitle?: string;
  defaultCategoryId?: number | null;
  defaultDeliverable?: string | null;
  defaultIsMit?: boolean;
  /** When set, dialog header reads this instead of the default 新建 wording. */
  titleHint?: string;
  onCancel: () => void;
  onCreated: (id: number) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [taskId, setTaskId] = useState<number | "new">("new");
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(
    defaultCategoryId ?? null
  );
  const [date, setDate] = useState(defaultDate ?? todayISO());
  const [time, setTime] = useState(defaultStartTime ?? nextQuarter());
  const [minutes, setMinutes] = useState(defaultMinutes ?? 30);
  const [deliverable, setDeliverable] = useState(defaultDeliverable ?? "");
  const [isMit, setIsMit] = useState(!!defaultIsMit);

  useEffect(() => {
    Promise.all([listTasks({ status: "active" }), listCategories()]).then(
      ([t, c]) => {
        setTasks(t);
        setCats(c);
        if (categoryId == null && c[0]) setCategoryId(c[0].id);
      }
    );
  }, []);

  const submit = async () => {
    let resolvedTitle = title.trim();
    let resolvedCat = categoryId;
    let resolvedTaskId: number | null = null;

    if (taskId !== "new") {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      resolvedTitle = task.title;
      resolvedCat = task.category_id;
      resolvedTaskId = task.id;
    }
    if (!resolvedTitle) return;

    const tb = await createTimebox({
      task_id: resolvedTaskId,
      title: resolvedTitle,
      category_id: resolvedCat,
      planned_start: isoForLocalDateTime(date, time),
      planned_minutes: minutes,
      deliverable: deliverable.trim() || null,
      is_mit: isMit,
    });
    onCreated(tb.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[560px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{titleHint ?? "新建时间盒"}</h2>
          <span className="text-xs text-[var(--color-muted)]">
            书 · 第 11 章「三步」
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              选任务（或输入新任务）
            </label>
            <select
              value={taskId}
              onChange={(e) =>
                setTaskId(
                  e.target.value === "new" ? "new" : Number(e.target.value)
                )
              }
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            >
              <option value="new">+ 新任务（直接开干）</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {labelFor(t, cats)}
                </option>
              ))}
            </select>
          </div>

          {taskId === "new" ? (
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="时间盒要做什么？"
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <div className="flex flex-wrap items-center gap-1">
                {cats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className="rounded-full px-2 py-1 text-xs"
                    style={
                      categoryId === c.id
                        ? { background: c.color, color: "white" }
                        : { background: `${c.color}26`, color: c.color }
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-muted)]">
                日期
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-muted)]">
                开始时间
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-muted)]">
                时长（分钟）
              </label>
              <input
                type="number"
                min={5}
                step={5}
                value={minutes}
                onChange={(e) =>
                  setMinutes(Math.max(5, Number(e.target.value) || 30))
                }
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {COMMON_DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setMinutes(d)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
              >
                {d}'
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              可见交付 / Deliverable{" "}
              <span className="text-[10px] opacity-60">
                这一格结束时要拿出什么？写得越具体越容易赢
              </span>
            </label>
            <textarea
              rows={2}
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              placeholder="例：写完文章开头 8 句话 / 列出 10 个要点 / 跑通登录流程一次"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)] px-3 py-2 text-sm transition hover:border-[var(--color-border)]">
            <input
              type="checkbox"
              checked={isMit}
              onChange={(e) => setIsMit(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col leading-tight">
              <span className="font-medium">设为今日 MIT（最重要的一件事）</span>
              <span className="text-[10px] text-[var(--color-muted)]">
                每天只一个 — 完成它就是今天最大的赢
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm hover:bg-[var(--color-surface-3)]"
          >
            取消
          </button>
          <button
            onClick={submit}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            放入日历
          </button>
        </div>
      </div>
    </div>
  );
}

function labelFor(task: Task, cats: Category[]): string {
  const c = cats.find((c) => c.id === task.category_id);
  const prefix = c ? `[${c.name}] ` : "";
  const est = task.estimated_min ? ` · ${task.estimated_min}m` : "";
  return `${prefix}${task.title}${est}`;
}

function nextQuarter(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}
