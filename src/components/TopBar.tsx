import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useActiveTimer, useTimerComplete, timerStop } from "../lib/timer";
import { fmtClock } from "../lib/format";
import { getActiveTimebox, completeTimebox, listCategories } from "../lib/db";
import type { Category, Timebox } from "../lib/types";
import { AcceptDialog } from "./AcceptDialog";
import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { playCompleteChime, playOverrunBeep } from "../lib/sound";

export function TopBar() {
  const { snap } = useActiveTimer();
  const [active, setActive] = useState<Timebox | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [acceptOpen, setAcceptOpen] = useState(false);

  useEffect(() => {
    listCategories().then(setCats);
  }, []);

  useEffect(() => {
    if (snap?.timebox_id) {
      getActiveTimebox().then(setActive);
    } else {
      setActive(null);
    }
  }, [snap?.timebox_id]);

  // Bell + native notification + open accept dialog when a box hits 0.
  useTimerComplete(async (s) => {
    playCompleteChime();
    try {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (granted) {
        sendNotification({
          title: "时间盒结束",
          body: `${s.title} · 验收一下吧`,
        });
      }
    } catch {}
    setAcceptOpen(true);
  });

  // 兔子洞 alert: a soft beep once when the box first goes into overrun.
  const overrunSignaled = useRef(false);
  useEffect(() => {
    if (snap?.overrun && !overrunSignaled.current) {
      overrunSignaled.current = true;
      playOverrunBeep();
    } else if (!snap?.overrun) {
      overrunSignaled.current = false;
    }
  }, [snap?.overrun]);

  const overrun = !!snap?.overrun;
  const cat = cats.find((c) => c.id === active?.category_id);

  return (
    <>
      <header
        className={clsx(
          "relative flex h-14 items-center border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 transition-colors",
          snap && !overrun && "bg-gradient-to-r from-[var(--color-surface)] via-[var(--color-surface-2)] to-[var(--color-surface)]",
          snap && overrun && "bg-[var(--color-accent)]/10"
        )}
      >
        {snap ? (
          <>
            <div className="relative flex items-center justify-center">
              <span
                className="absolute h-3 w-3 rounded-full animate-pulse-ring"
                style={{ background: cat?.color ?? "var(--color-accent)" }}
              />
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: cat?.color ?? "var(--color-accent)" }}
              />
            </div>
            <div className="ml-3 flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                {cat?.name ?? "未分类"} · 时间盒进行中
              </span>
              <span className="truncate text-base font-medium">{snap.title}</span>
            </div>
            <div
              className={clsx(
                "ml-auto font-mono text-3xl font-light tabular-nums tracking-tight",
                overrun
                  ? "text-[var(--color-accent)] animate-breathe"
                  : "text-[var(--color-text)]"
              )}
            >
              {fmtClock(snap.remaining_secs)}
            </div>
            <div className="ml-4 flex gap-2">
              <button
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white shadow-lg shadow-[var(--color-accent)]/20 transition hover:opacity-90 hover:shadow-[var(--color-accent)]/40"
                onClick={() => setAcceptOpen(true)}
              >
                验收
              </button>
              <button
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted)] transition hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]"
                onClick={async () => {
                  await timerStop();
                }}
              >
                取消
              </button>
            </div>

            {/* Progress bar across the bottom of the header. */}
            <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[var(--color-border-soft)]">
              <div
                className={clsx(
                  "h-full transition-[width] duration-1000 ease-linear",
                  overrun ? "bg-[var(--color-accent)]" : "bg-current"
                )}
                style={{
                  width: `${progressPercent(snap.elapsed_secs, snap.planned_minutes)}%`,
                  color: cat?.color ?? "var(--color-accent)",
                }}
              />
            </div>
          </>
        ) : (
          <div className="ml-auto text-xs text-[var(--color-muted)]">
            没有进行中的时间盒
          </div>
        )}
      </header>

      {acceptOpen && active && snap ? (
        <AcceptDialog
          timebox={active}
          onClose={() => setAcceptOpen(false)}
          onSubmit={async (payload) => {
            await completeTimebox(active.id, payload);
            const wasMIT = active.is_mit === 1;
            await timerStop();
            setAcceptOpen(false);
            if (wasMIT) {
              window.dispatchEvent(
                new CustomEvent("mit-win", {
                  detail: { title: active.title },
                })
              );
            }
          }}
        />
      ) : null}
    </>
  );
}

function progressPercent(elapsedSecs: number, plannedMinutes: number): number {
  const total = Math.max(1, plannedMinutes * 60);
  return Math.min(100, Math.max(0, (elapsedSecs / total) * 100));
}
