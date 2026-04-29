import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  completeEveningReview,
  deleteTimebox,
  getOrCreateDailyPlan,
  listCategories,
  listTimeboxes,
  statsByCategory,
  type CategoryStat,
} from "../lib/db";
import type { Category, DailyPlan, Timebox } from "../lib/types";
import { addDays, fmtFullDate, fmtMinutes, fmtTime, todayISO } from "../lib/format";
import { CategoryPill } from "../components/CategoryDot";
import { StartBoxDialog } from "../components/StartBoxDialog";

type Range = "today" | "week" | "month";

export function Review() {
  const [range, setRange] = useState<Range>("week");
  const [boxes, setBoxes] = useState<Timebox[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [redoFor, setRedoFor] = useState<Timebox | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (confirmDeleteId == null) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  const window = useMemo(() => {
    const today = todayISO();
    if (range === "today")
      return { from: today, to: addDays(today, 1), label: "今天" };
    if (range === "week")
      return { from: addDays(today, -6), to: addDays(today, 1), label: "近 7 天" };
    return { from: addDays(today, -29), to: addDays(today, 1), label: "近 30 天" };
  }, [range]);

  const load = useCallback(async () => {
    const [b, c, s] = await Promise.all([
      listTimeboxes({
        fromDate: window.from,
        toDate: window.to,
        status: ["done"],
      }),
      listCategories(),
      statsByCategory(window.from, window.to),
    ]);
    setBoxes(b);
    setCats(c);
    setStats(s);
  }, [window.from, window.to]);

  useEffect(() => {
    load();
  }, [load]);

  const totalMin = stats.reduce((s, x) => s + x.minutes, 0);
  const totalBoxes = stats.reduce((s, x) => s + x.boxes, 0);
  const avgFeeling =
    boxes.length === 0
      ? 0
      : boxes.reduce((s, b) => s + (b.feeling ?? 0), 0) / boxes.length;

  const grouped = useMemo(() => {
    const map = new Map<string, Timebox[]>();
    for (const b of [...boxes].reverse()) {
      const day = b.planned_start.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(b);
    }
    return Array.from(map.entries());
  }, [boxes]);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <EveningReviewBlock />

      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">复盘</h1>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {window.label} · 已验收 {totalBoxes} 个时间盒，共{" "}
            {fmtMinutes(totalMin)} · 平均自评{" "}
            {avgFeeling ? avgFeeling.toFixed(1) : "—"}/5
          </p>
        </div>
        <div className="flex gap-1">
          {(["today", "week", "month"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs",
                range === r
                  ? "bg-[var(--color-surface-3)] text-[var(--color-text)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
              )}
            >
              {r === "today" ? "今天" : r === "week" ? "7 天" : "30 天"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-xs uppercase tracking-wider text-[var(--color-muted)]">
          时间分布
        </h3>
        {totalMin === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">还没有可复盘的数据。</p>
        ) : (
          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              {stats.map((s) => (
                <div
                  key={s.category_id ?? "none"}
                  style={{
                    width: `${(s.minutes / totalMin) * 100}%`,
                    background: s.color ?? "var(--color-muted)",
                  }}
                  title={`${s.name ?? "未分类"} · ${fmtMinutes(s.minutes)}`}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.category_id ?? "none"}
                  className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: s.color ?? "var(--color-muted)",
                      }}
                    />
                    <span className="text-xs text-[var(--color-muted)]">
                      {s.name ?? "未分类"}
                    </span>
                  </div>
                  <div className="mt-1 text-base font-medium">
                    {fmtMinutes(s.minutes)}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    {s.boxes} 个时间盒
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--color-muted)]">
        已验收记录
      </h3>
      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted)]">
          没有已验收的时间盒
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="mb-1 text-xs text-[var(--color-muted)]">{day}</div>
              <div className="space-y-1.5">
                {items.map((b) => {
                  const cat = cats.find((c) => c.id === b.category_id);
                  return (
                    <div
                      key={b.id}
                      className="group rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[var(--color-muted)]">
                          {fmtTime(b.planned_start)}
                        </span>
                        <CategoryPill category={cat ?? null} />
                        <span className="flex-1 truncate text-sm">{b.title}</span>
                        <span className="text-xs text-[var(--color-muted)]">
                          {b.planned_minutes}m · ⭐ {b.feeling ?? "—"}
                          {b.interrupted > 0 ? ` · 分心 ${b.interrupted}` : ""}
                        </span>
                        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                          <button
                            onClick={() => setRedoFor(b)}
                            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
                            title="再排一次"
                          >
                            再来
                          </button>
                          <button
                            onClick={async () => {
                              if (confirmDeleteId === b.id) {
                                await deleteTimebox(b.id);
                                setConfirmDeleteId(null);
                                await load();
                              } else {
                                setConfirmDeleteId(b.id);
                              }
                            }}
                            className={clsx(
                              "rounded-md border px-2 py-1 text-[10px] transition",
                              confirmDeleteId === b.id
                                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                                : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
                            )}
                            title={confirmDeleteId === b.id ? "再点一次确认删除" : "删除"}
                          >
                            {confirmDeleteId === b.id ? "确认?" : "×"}
                          </button>
                        </div>
                      </div>
                      {b.output ? (
                        <div className="mt-2 pl-12 text-xs">
                          <span className="text-[var(--color-muted)]">产出：</span>{" "}
                          {b.output}
                        </div>
                      ) : null}
                      {b.next_step ? (
                        <div className="mt-1 pl-12 text-xs">
                          <span className="text-[var(--color-muted)]">下一步：</span>{" "}
                          {b.next_step}
                        </div>
                      ) : null}
                      {b.actual_end ? (
                        <div className="mt-1 pl-12 text-[10px] text-[var(--color-muted)]">
                          完成于 {fmtFullDate(b.actual_end)}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {redoFor ? (
        <StartBoxDialog
          defaultTitle={redoFor.title}
          defaultCategoryId={redoFor.category_id ?? undefined}
          defaultMinutes={redoFor.planned_minutes}
          titleHint="再来一次"
          onCancel={() => setRedoFor(null)}
          onCreated={async () => {
            setRedoFor(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

const REVIEW_QUESTIONS: {
  key: "best_action" | "main_obstacle" | "obstacle_response" | "keep_action" | "drop_action";
  q: string;
  hint: string;
}[] = [
  { key: "best_action",       q: "今天最有效的动作是什么？",   hint: "复盘是系统升级入口，先看亮点" },
  { key: "main_obstacle",     q: "今天最大的阻力是什么？",     hint: "环境、情绪、任务设计、身体状态" },
  { key: "obstacle_response", q: "阻力出现时，我做了什么？",   hint: "诚实写，不评判" },
  { key: "keep_action",       q: "明天我要保留哪个动作？",     hint: "一个就好，可执行的动作" },
  { key: "drop_action",       q: "明天我要删除哪个动作？",     hint: "减一件比加一件更管用" },
];

function EveningReviewBlock() {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const refresh = useCallback(async () => {
    const p = await getOrCreateDailyPlan(todayISO());
    setPlan(p);
    setVals({
      best_action: p.review_best_action ?? "",
      main_obstacle: p.review_main_obstacle ?? "",
      obstacle_response: p.review_obstacle_response ?? "",
      keep_action: p.review_keep_action ?? "",
      drop_action: p.review_drop_action ?? "",
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completed = !!plan?.review_completed_at;

  const submit = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await completeEveningReview(plan.id, {
        best_action: vals.best_action ?? "",
        main_obstacle: vals.main_obstacle ?? "",
        obstacle_response: vals.obstacle_response ?? "",
        keep_action: vals.keep_action ?? "",
        drop_action: vals.drop_action ?? "",
      });
      await refresh();
      setOpen(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2400);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={clsx(
        "mb-8 animate-fade-in overflow-hidden rounded-xl border transition-all",
        completed
          ? "border-[var(--color-cat-life)]/30 bg-[var(--color-cat-life)]/[0.04]"
          : "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.04]"
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[var(--color-surface-2)]"
      >
        <span className="text-xl">{completed ? "✅" : "🌙"}</span>
        <div className="flex-1">
          <div className="text-sm font-medium">
            {completed ? "今日复盘已完成" : "今日复盘 · 5 个问题"}
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            {completed
              ? "继续保持 — streak 还在跑"
              : "15 分钟接通反馈回路；完成后才计入连续打卡"}
            {justSaved ? " · 已保存" : ""}
          </div>
        </div>
        <span className="text-xs text-[var(--color-muted)]">{open ? "收起" : "展开"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
          {REVIEW_QUESTIONS.map((q, idx) => (
            <div key={q.key}>
              <label className="mb-1 block text-xs">
                <span className="font-mono text-[var(--color-muted)]">
                  {idx + 1}.
                </span>{" "}
                <span>{q.q}</span>{" "}
                <span className="text-[10px] text-[var(--color-muted)]">
                  · {q.hint}
                </span>
              </label>
              <textarea
                rows={2}
                value={vals[q.key] ?? ""}
                onChange={(e) =>
                  setVals((prev) => ({ ...prev, [q.key]: e.target.value }))
                }
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-[var(--color-muted)]">
              复盘不是自责大会，是系统升级入口
            </p>
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "保存中…" : completed ? "更新复盘" : "完成今日复盘"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
