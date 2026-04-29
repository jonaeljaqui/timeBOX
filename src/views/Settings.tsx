import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "../lib/db";
import type { Settings as SettingsT } from "../lib/types";

export function Settings() {
  const [s, setS] = useState<SettingsT | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setS);
  }, []);

  if (!s)
    return (
      <div className="p-8 text-sm text-[var(--color-muted)]">加载中…</div>
    );

  const save = async (patch: Partial<SettingsT>) => {
    await updateSettings(patch);
    const next = await getSettings();
    setS(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">设置</h1>
        {saved ? (
          <span className="text-xs text-[var(--color-cat-life)]">已保存</span>
        ) : null}
      </div>

      <div className="space-y-6">
        <Section title="工作时段">
          <Field label="开始">
            <input
              type="time"
              value={s.work_day_start}
              onChange={(e) => save({ work_day_start: e.target.value })}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </Field>
          <Field label="结束">
            <input
              type="time"
              value={s.work_day_end}
              onChange={(e) => save({ work_day_end: e.target.value })}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </Field>
        </Section>

        <Section title="时间盒默认">
          <Field label="默认时长（分钟）">
            <input
              type="number"
              min={5}
              step={5}
              value={s.default_box_minutes}
              onChange={(e) =>
                save({
                  default_box_minutes: Math.max(5, Number(e.target.value) || 30),
                })
              }
              className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </Field>
          <Field label="超时警告（分钟）">
            <input
              type="number"
              min={0}
              step={1}
              value={s.overrun_warn_minutes}
              onChange={(e) =>
                save({
                  overrun_warn_minutes: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </Field>
        </Section>

        <Section title="提醒">
          <Field label="每日规划提醒时间">
            <input
              type="time"
              value={s.daily_plan_reminder_at}
              onChange={(e) => save({ daily_plan_reminder_at: e.target.value })}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </Field>
        </Section>

        <Section title="坚持">
          <Field label="连续规划天数">
            <span className="text-base font-medium">{s.streak_count}</span>
          </Field>
        </Section>

        <p className="pt-4 text-xs text-[var(--color-muted)]">
          数据存放在 ~/Library/Application Support/com.yang.timebox/timebox.db
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-3 text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}
