import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  createTask,
  deleteTask,
  listCategories,
  listTasks,
  updateTask,
} from "../lib/db";
import type { Category, Task } from "../lib/types";
import { CategoryPill } from "../components/CategoryDot";
import { StartBoxDialog } from "../components/StartBoxDialog";

export function Inbox() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [filter, setFilter] = useState<number | "all">("all");
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState<number | "">("");
  const [pickedCat, setPickedCat] = useState<number | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (confirmDeleteId == null) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  const requestDelete = async (id: number) => {
    if (confirmDeleteId === id) {
      await deleteTask(id);
      setConfirmDeleteId(null);
      await load();
    } else {
      setConfirmDeleteId(id);
    }
  };

  const load = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([
        listTasks({ status: "active" }),
        listCategories(),
      ]);
      setTasks(t);
      setCats(c);
      if (!pickedCat && c[0]) setPickedCat(c[0].id);
    } catch (e) {
      setError(`加载失败：${(e as Error).message ?? e}`);
    }
  }, [pickedCat]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    filter === "all" ? tasks : tasks.filter((t) => t.category_id === filter);

  const submit = async () => {
    setError(null);
    const t = title.trim();
    if (!t) {
      setError("请先输入任务内容");
      return;
    }
    try {
      await createTask({
        title: t,
        category_id: pickedCat,
        estimated_min: typeof estimate === "number" ? estimate : null,
      });
      setTitle("");
      setEstimate("");
      await load();
    } catch (e) {
      console.error("createTask failed", e);
      setError(`保存失败：${(e as Error).message ?? e}`);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">收件箱</h1>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          所有想法先丢进来，再决定哪些值得放入时间盒（书 · 第 10 章）
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="加点什么？（Enter 保存）"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-base outline-none transition focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
        />
        {error ? (
          <p className="mt-2 text-xs text-[var(--color-accent)]">{error}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setPickedCat(c.id)}
                className="rounded-full px-2 py-0.5 text-xs"
                style={
                  pickedCat === c.id
                    ? { background: c.color, color: "white" }
                    : { background: `${c.color}26`, color: c.color }
                }
              >
                {c.name}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={5}
            step={5}
            value={estimate}
            onChange={(e) =>
              setEstimate(
                e.target.value === ""
                  ? ""
                  : Math.max(0, Number(e.target.value))
              )
            }
            placeholder="估时(分)"
            className="ml-auto w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button
            onClick={submit}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            添加
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1 text-xs">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          全部 ({tasks.length})
        </FilterChip>
        {cats.map((c) => {
          const n = tasks.filter((t) => t.category_id === c.id).length;
          return (
            <FilterChip
              key={c.id}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
              color={c.color}
            >
              {c.name} ({n})
            </FilterChip>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted)]">
          收件箱空空如也
        </div>
      ) : (
        <div className="stagger space-y-2">
          {filtered.map((task) => {
            const cat = cats.find((c) => c.id === task.category_id);
            return (
              <div
                key={task.id}
                className="group flex animate-slide-in items-center gap-3 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3 transition-all duration-200 hover:-translate-y-px hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:shadow-lg hover:shadow-black/20"
              >
                <CategoryPill category={cat ?? null} />
                <div className="flex-1 truncate text-base">{task.title}</div>
                {task.estimated_min ? (
                  <span className="text-sm text-[var(--color-muted)]">
                    {task.estimated_min}m
                  </span>
                ) : null}
                {task.status === "scheduled" ? (
                  <span className="rounded-md bg-[var(--color-cat-learn)]/20 px-2 py-0.5 text-[10px] text-[var(--color-cat-learn)]">
                    已排期
                  </span>
                ) : null}
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => setScheduleFor(task)}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs hover:bg-[var(--color-surface-3)]"
                  >
                    排日历
                  </button>
                  <button
                    onClick={async () => {
                      await updateTask(task.id, { status: "dropped" });
                      await load();
                    }}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
                  >
                    放弃
                  </button>
                  <button
                    onClick={() => requestDelete(task.id)}
                    className={clsx(
                      "rounded-md border px-2 py-1 text-xs transition",
                      confirmDeleteId === task.id
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                        : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
                    )}
                    title={confirmDeleteId === task.id ? "再点一次确认删除" : "删除"}
                  >
                    {confirmDeleteId === task.id ? "确认?" : "×"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scheduleFor ? (
        <StartBoxDialog
          defaultMinutes={scheduleFor.estimated_min ?? 30}
          onCancel={() => setScheduleFor(null)}
          onCreated={async () => {
            setScheduleFor(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-full border px-3 py-1 transition",
        active
          ? "border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-text)]"
          : "border-transparent bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
      )}
      style={active && color ? { borderColor: color, color } : undefined}
    >
      {children}
    </button>
  );
}
