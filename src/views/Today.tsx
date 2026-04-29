import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  completeTimebox,
  deleteTimebox,
  getOrCreateDailyPlan,
  getStreak,
  getTodayMIT,
  listCategories,
  listTimeboxes,
  markTimeboxActive,
  setMIT,
  clearMIT,
  updateDailyPlan,
} from "../lib/db";
import { useActiveTimer, timerStart, timerStop } from "../lib/timer";
import type { Category, DailyPlan, Timebox } from "../lib/types";
import { addDays, fmtClock, fmtMinutes, fmtTime, todayISO } from "../lib/format";
import { CategoryPill } from "../components/CategoryDot";
import { StartBoxDialog } from "../components/StartBoxDialog";
import { AcceptDialog } from "../components/AcceptDialog";
import { useCapture } from "../components/CaptureProvider";
import { playMITFanfare } from "../lib/sound";

export function Today() {
  const [boxes, setBoxes] = useState<Timebox[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [intention, setIntention] = useState("");
  const [streakCount, setStreakCount] = useState(0);
  const [createPrefill, setCreatePrefill] = useState<{
    title?: string;
    categoryId?: number | null;
    minutes?: number;
    titleHint?: string;
    deliverable?: string | null;
    is_mit?: boolean;
  } | null>(null);
  const [acceptFor, setAcceptFor] = useState<Timebox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<{ title: string } | null>(null);
  const { snap } = useActiveTimer();
  const capture = useCapture();

  // Auto-reset the two-step delete confirmation after 3s of inactivity.
  useEffect(() => {
    if (confirmDeleteId == null) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  const requestDelete = async (id: number) => {
    if (confirmDeleteId === id) {
      await deleteTimebox(id);
      setConfirmDeleteId(null);
      await load();
    } else {
      setConfirmDeleteId(id);
    }
  };

  const load = useCallback(async () => {
    const today = todayISO();
    const [tb, c, p, st] = await Promise.all([
      listTimeboxes({ fromDate: today, toDate: addDays(today, 1) }),
      listCategories(),
      getOrCreateDailyPlan(today),
      getStreak(today),
    ]);
    setBoxes(tb);
    setCats(c);
    setPlan(p);
    setIntention(p.intention ?? "");
    setStreakCount(st.count);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for MIT-win events emitted from any completion handler.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ title: string }>).detail;
      setCelebration({ title: detail.title });
      playMITFanfare();
      setTimeout(() => setCelebration(null), 5500);
    };
    window.addEventListener("mit-win", handler as EventListener);
    return () => window.removeEventListener("mit-win", handler as EventListener);
  }, []);

  // Reload boxes whenever timer state changes (start/stop transitions affect rows).
  useEffect(() => {
    load();
  }, [snap?.timebox_id, load]);

  const totalPlanned = boxes.reduce((sum, b) => sum + b.planned_minutes, 0);
  const doneMinutes = boxes
    .filter((b) => b.status === "done")
    .reduce((sum, b) => sum + b.planned_minutes, 0);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex animate-fade-in items-baseline justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">今日时间盒</h1>
            {streakCount > 0 ? (
              <span
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400"
                title="连续完成晚间复盘的天数"
              >
                🔥 连续 {streakCount} 天
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
            {todayHeader()} · 计划 {fmtMinutes(totalPlanned)} · 已完成{" "}
            <span className="text-[var(--color-text)]">{fmtMinutes(doneMinutes)}</span>{" "}
            ({totalPlanned ? Math.round((doneMinutes / totalPlanned) * 100) : 0}%)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={capture.open}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs hover:bg-[var(--color-surface-3)]"
          >
            捕获想法 ⌘N
          </button>
          <button
            onClick={() => setCreatePrefill({})}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            + 新建时间盒
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          今日意图（一句话）
        </label>
        <input
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          onBlur={() => plan && updateDailyPlan(plan.id, { intention })}
          placeholder="今天最重要的一件事是…"
          className="w-full bg-transparent text-base outline-none placeholder:text-[var(--color-muted)]"
        />
      </div>

      {celebration ? (
        <div className="mb-4 animate-slide-in overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 p-4 shadow-lg shadow-amber-500/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-breathe">🎯</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-amber-300">
                今日 MIT 完成 — 你赢了
              </div>
              <div className="text-xs text-amber-300/70">
                「{celebration.title}」 · 大脑现在收到了"我赢了"的信号 · 这就是轨道偏转一度的起点
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-2 text-xs text-[var(--color-accent)]">
          {error}
        </div>
      ) : null}

      {boxes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted)]">
          今天还没有时间盒。先去
          <button
            className="mx-1 underline hover:text-[var(--color-text)]"
            onClick={() => setCreatePrefill({})}
          >
            新建一个
          </button>
          ，或在「规划」里完成今日计划。
        </div>
      ) : (
        <div className="stagger space-y-2.5">
          {boxes.map((b) => {
            const cat = cats.find((c) => c.id === b.category_id);
            const isActive = snap?.timebox_id === b.id;
            const isMit = b.is_mit === 1;
            const progress = isActive && snap
              ? Math.min(100, Math.max(0, (snap.elapsed_secs / Math.max(1, b.planned_minutes * 60)) * 100))
              : 0;
            return (
              <div
                key={b.id}
                className={clsx(
                  "group relative animate-slide-in overflow-hidden rounded-xl border transition-all duration-300",
                  isActive
                    ? "scale-[1.01] border-[var(--color-accent)] bg-gradient-to-br from-[var(--color-surface-2)] via-[var(--color-surface)] to-[var(--color-surface-2)] p-5 animate-accent-glow"
                    : b.status === "done"
                    ? "border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4 opacity-75 hover:opacity-100"
                    : isMit
                    ? "border-amber-500/40 bg-amber-500/[0.04] p-4 hover:border-amber-500/60 hover:bg-amber-500/[0.07]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    "font-mono tabular-nums text-[var(--color-muted)]",
                    isActive ? "text-base" : "text-sm"
                  )}>
                    {fmtTime(b.planned_start)}
                  </div>
                  {isActive ? (
                    <div className="relative flex items-center justify-center">
                      <span
                        className="absolute h-2.5 w-2.5 rounded-full animate-pulse-ring"
                        style={{ background: cat?.color ?? "var(--color-accent)" }}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: cat?.color ?? "var(--color-accent)" }}
                      />
                    </div>
                  ) : null}
                  <CategoryPill category={cat ?? null} />
                  {isMit ? (
                    <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-400">
                      MIT ✦
                    </span>
                  ) : null}
                  <button
                    onClick={async () => {
                      if (isMit) {
                        await clearMIT(b.id);
                      } else {
                        await setMIT(b.id, b.planned_start.slice(0, 10));
                      }
                      await load();
                    }}
                    className={clsx(
                      "transition-all",
                      isMit
                        ? "hidden"
                        : "text-base text-[var(--color-muted)] opacity-0 group-hover:opacity-100 hover:scale-110 hover:text-amber-400"
                    )}
                    title="标记为今日 MIT"
                  >
                    ☆
                  </button>
                  <div className={clsx(
                    "flex-1 truncate font-medium",
                    isActive ? "text-lg" : "text-base"
                  )}>
                    {b.title}
                  </div>
                  <div className={clsx(
                    "text-[var(--color-muted)]",
                    isActive ? "text-sm" : "text-xs"
                  )}>
                    {b.planned_minutes}m
                  </div>

                  {b.status === "done" || b.status === "skipped" || b.status === "cancelled" ? (
                    <>
                      <span
                        className={clsx(
                          "rounded-md px-2 py-1 text-[10px]",
                          b.status === "done"
                            ? "bg-[var(--color-cat-life)]/20 text-[var(--color-cat-life)]"
                            : "bg-[var(--color-surface-3)] text-[var(--color-muted)]"
                        )}
                      >
                        {b.status === "done"
                          ? "已验收"
                          : b.status === "skipped"
                          ? "已跳过"
                          : "已取消"}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() =>
                            setCreatePrefill({
                              title: b.title,
                              categoryId: b.category_id,
                              minutes: b.planned_minutes,
                              titleHint: "再来一次",
                            })
                          }
                          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
                          title="再排一次"
                        >
                          再来
                        </button>
                        <button
                          onClick={() => requestDelete(b.id)}
                          className={clsx(
                            "rounded-md border px-2 py-1 text-xs transition",
                            confirmDeleteId === b.id
                              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                              : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
                          )}
                          title={confirmDeleteId === b.id ? "再点一次确认删除" : "删除"}
                        >
                          {confirmDeleteId === b.id ? "确认?" : "×"}
                        </button>
                      </div>
                    </>
                  ) : isActive ? (
                    <button
                      onClick={() => setAcceptFor(b)}
                      className="rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                    >
                      验收
                    </button>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={async () => {
                          setError(null);
                          try {
                            await markTimeboxActive(b.id);
                            await timerStart({
                              timebox_id: b.id,
                              title: b.title,
                              category: cat?.name ?? null,
                              planned_minutes: b.planned_minutes,
                            });
                          } catch (e) {
                            console.error("start timebox failed", e);
                            setError(`开启失败：${(e as Error).message ?? e}`);
                          }
                        }}
                        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1 text-xs hover:bg-[var(--color-surface-3)]"
                      >
                        开启
                      </button>
                      <button
                        onClick={() => requestDelete(b.id)}
                        className={clsx(
                          "rounded-md border px-2 py-1 text-xs transition",
                          confirmDeleteId === b.id
                            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                            : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
                        )}
                        title={confirmDeleteId === b.id ? "再点一次确认删除" : "删除"}
                      >
                        {confirmDeleteId === b.id ? "确认?" : "×"}
                      </button>
                    </div>
                  )}
                </div>
                {b.status === "done" && b.output ? (
                  <p className="mt-2 line-clamp-2 pl-12 text-sm text-[var(--color-muted)]">
                    {b.output}
                  </p>
                ) : null}

                {/* Animated progress bar — only on the active box. */}
                {isActive ? (
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-[10px] text-[var(--color-muted)]">
                      <span>已用 {Math.floor((snap?.elapsed_secs ?? 0) / 60)}m {(snap?.elapsed_secs ?? 0) % 60}s</span>
                      <span className={clsx(
                        "font-mono tabular-nums",
                        snap?.overrun && "text-[var(--color-accent)] animate-breathe"
                      )}>
                        {snap ? fmtClock(snap.remaining_secs) : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-linear"
                        style={{
                          width: `${progress}%`,
                          background: snap?.overrun ? "var(--color-accent)" : cat?.color ?? "var(--color-accent)",
                          boxShadow: snap?.overrun
                            ? "0 0 12px rgba(239, 68, 68, 0.6)"
                            : `0 0 8px ${cat?.color ?? "var(--color-accent)"}aa`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {createPrefill ? (
        <StartBoxDialog
          defaultTitle={createPrefill.title}
          defaultCategoryId={createPrefill.categoryId ?? undefined}
          defaultMinutes={createPrefill.minutes}
          titleHint={createPrefill.titleHint}
          onCancel={() => setCreatePrefill(null)}
          onCreated={async () => {
            setCreatePrefill(null);
            await load();
          }}
        />
      ) : null}

      {acceptFor ? (
        <AcceptDialog
          timebox={acceptFor}
          onClose={() => setAcceptFor(null)}
          onSubmit={async (payload) => {
            await completeTimebox(acceptFor.id, payload);
            const wasMIT = acceptFor.is_mit === 1;
            if (snap?.timebox_id === acceptFor.id) {
              await timerStop();
            }
            setAcceptFor(null);
            await load();
            if (wasMIT) {
              window.dispatchEvent(
                new CustomEvent("mit-win", {
                  detail: { title: acceptFor.title },
                })
              );
            }
          }}
        />
      ) : null}
    </div>
  );
}

function todayHeader() {
  const d = new Date();
  const wk = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} 周${wk}`;
}
