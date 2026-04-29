import { useState } from "react";
import clsx from "clsx";
import type { Timebox } from "../lib/types";

export function AcceptDialog({
  timebox,
  onClose,
  onSubmit,
}: {
  timebox: Timebox;
  onClose: () => void;
  onSubmit: (payload: {
    output: string;
    feeling: number;
    next_step: string;
    interrupted: number;
  }) => void | Promise<void>;
}) {
  const [output, setOutput] = useState(timebox.output ?? "");
  const [feeling, setFeeling] = useState(timebox.feeling ?? 4);
  const [nextStep, setNextStep] = useState(timebox.next_step ?? "");
  const [interrupted, setInterrupted] = useState(timebox.interrupted ?? 0);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[520px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        <div className="mb-1 text-xs uppercase tracking-wider text-[var(--color-muted)]">
          验收 · Accept
        </div>
        <h2 className="text-lg font-semibold">{timebox.title}</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          这一格产出了什么？感觉怎样？下一步是什么？
        </p>

        <div className="mt-5 space-y-4">
          {timebox.deliverable ? (
            <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                计划交付
              </div>
              <div className="mt-0.5 text-sm">{timebox.deliverable}</div>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              {timebox.deliverable ? "实际产出 / Output" : "产出 / Output"}
            </label>
            <textarea
              autoFocus
              rows={3}
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              placeholder={
                timebox.deliverable
                  ? "对照计划，实际拿出来的是什么？没全做到也没关系，写实情就好"
                  : "完成了什么？写了什么？想清楚了什么？"
              }
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="text-xs text-[var(--color-muted)]">感受 / Feeling</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFeeling(n)}
                  className={clsx(
                    "h-7 w-7 rounded-md text-sm",
                    n <= feeling
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:bg-[var(--color-surface-3)]"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-xs text-[var(--color-muted)]">
              分心
              <input
                type="number"
                min={0}
                value={interrupted}
                onChange={(e) =>
                  setInterrupted(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-14 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              次
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              下一步 / Next step
            </label>
            <input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="一句话写下接下来要做的事"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm hover:bg-[var(--color-surface-3)]"
          >
            稍后
          </button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({
                  output,
                  feeling,
                  next_step: nextStep,
                  interrupted,
                });
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            完成验收
          </button>
        </div>
      </div>
    </div>
  );
}
