import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  createTimebox,
  getOrCreateDailyPlan,
  listCategories,
  listTasks,
  listTimeboxes,
  updateDailyPlan,
} from "../lib/db";
import type { Category, DailyPlan, Task, Timebox } from "../lib/types";
import {
  addDays,
  fmtMinutes,
  fmtTime,
  isoForLocalDateTime,
  todayISO,
} from "../lib/format";
import { CategoryPill } from "../components/CategoryDot";

export function Planner() {
  const [date, setDate] = useState(todayISO());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boxes, setBoxes] = useState<Timebox[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [intention, setIntention] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const load = useCallback(async () => {
    const [t, c, p, b] = await Promise.all([
      listTasks({ status: "active" }),
      listCategories(),
      getOrCreateDailyPlan(date),
      listTimeboxes({ fromDate: date, toDate: addDays(date, 1) }),
    ]);
    setTasks(t);
    setCats(c);
    setPlan(p);
    setIntention(p.intention ?? "");
    setBoxes(b);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const totalMinutes = boxes.reduce((s, b) => s + b.planned_minutes, 0);

  const finalize = async () => {
    if (!plan) return;
    await updateDailyPlan(plan.id, {
      intention,
      completed_at: new Date().toISOString(),
      boxes_planned: boxes.length,
      minutes_planned: totalMinutes,
    });
    setStep(3);
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">每日规划</h1>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            用 15 分钟换 15 小时的高效（书 · 第二部分）
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <Stepper step={step} setStep={setStep} />

      {step === 1 ? (
        <Step1Intention
          intention={intention}
          setIntention={setIntention}
          onNext={async () => {
            if (plan) await updateDailyPlan(plan.id, { intention });
            setStep(2);
          }}
        />
      ) : null}

      {step === 2 ? (
        <Step2PickAndPlace
          date={date}
          tasks={tasks}
          cats={cats}
          boxes={boxes}
          totalMinutes={totalMinutes}
          onChanged={load}
          onFinalize={finalize}
        />
      ) : null}

      {step === 3 ? (
        <Step3Done
          plan={plan}
          intention={intention}
          boxes={boxes}
          cats={cats}
          totalMinutes={totalMinutes}
          isToday={date === todayISO()}
          onConfirm={async () => {
            // Idempotent finalize — safe whether user clicked finalize earlier or jumped via stepper.
            if (plan && !plan.completed_at) {
              await updateDailyPlan(plan.id, {
                intention,
                completed_at: new Date().toISOString(),
                boxes_planned: boxes.length,
                minutes_planned: totalMinutes,
              });
            }
          }}
        />
      ) : null}
    </div>
  );
}

function Stepper({
  step,
  setStep,
}: {
  step: 1 | 2 | 3;
  setStep: (n: 1 | 2 | 3) => void;
}) {
  const items = [
    { n: 1 as const, label: "立意图" },
    { n: 2 as const, label: "选 + 排" },
    { n: 3 as const, label: "完成" },
  ];
  return (
    <div className="my-6 flex items-center gap-2">
      {items.map((it, idx) => (
        <button
          key={it.n}
          onClick={() => setStep(it.n)}
          className={clsx(
            "flex items-center gap-2 rounded-full px-3 py-1 text-xs",
            step === it.n
              ? "bg-[var(--color-accent)] text-white"
              : step > it.n
              ? "bg-[var(--color-surface-3)] text-[var(--color-text)]"
              : "bg-[var(--color-surface-2)] text-[var(--color-muted)]"
          )}
        >
          <span className="font-mono">{it.n}.</span> {it.label}
          {idx < 2 ? <span className="text-[var(--color-muted)]">→</span> : null}
        </button>
      ))}
    </div>
  );
}

function Step1Intention({
  intention,
  setIntention,
  onNext,
}: {
  intention: string;
  setIntention: (s: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <p className="mb-4 text-sm text-[var(--color-muted)]">
        今天若只做成一件事，会是什么？把它写下来——这是后面排时间盒的指南针。
      </p>
      <textarea
        autoFocus
        rows={3}
        value={intention}
        onChange={(e) => setIntention(e.target.value)}
        placeholder="例：写完产品 v0.1 的核心交互，跑通一次。"
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-base outline-none focus:border-[var(--color-accent)]"
      />
      <div className="mt-4 flex justify-end">
        <button
          onClick={onNext}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          下一步：选任务、排时间
        </button>
      </div>
    </div>
  );
}

function Step2PickAndPlace({
  date,
  tasks,
  cats,
  boxes,
  totalMinutes,
  onChanged,
  onFinalize,
}: {
  date: string;
  tasks: Task[];
  cats: Category[];
  boxes: Timebox[];
  totalMinutes: number;
  onChanged: () => void;
  onFinalize: () => void;
}) {
  const [selected, setSelected] = useState<Task | null>(null);
  const [time, setTime] = useState("09:00");
  const [minutes, setMinutes] = useState(30);

  const unscheduled = useMemo(() => {
    const inToday = new Set(boxes.map((b) => b.task_id).filter(Boolean));
    return tasks.filter((t) => !inToday.has(t.id));
  }, [tasks, boxes]);

  const place = async () => {
    if (!selected) return;
    await createTimebox({
      task_id: selected.id,
      title: selected.title,
      category_id: selected.category_id,
      planned_start: isoForLocalDateTime(date, time),
      planned_minutes: minutes,
    });
    setSelected(null);
    setTime(bumpTime(time, minutes));
    onChanged();
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="mb-2 text-sm text-[var(--color-muted)]">
          收件箱（点选放入今日）
        </h3>
        <div className="space-y-1.5">
          {unscheduled.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted)]">
              收件箱里没有未安排的任务
            </div>
          ) : null}
          {unscheduled.map((t) => {
            const cat = cats.find((c) => c.id === t.category_id);
            const isPicked = selected?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelected(t);
                  if (t.estimated_min) setMinutes(t.estimated_min);
                }}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                  isPicked
                    ? "border-[var(--color-accent)] bg-[var(--color-surface-2)]"
                    : "border-[var(--color-border-soft)] bg-[var(--color-surface)] hover:border-[var(--color-border)]"
                )}
              >
                <CategoryPill category={cat ?? null} />
                <span className="flex-1 truncate">{t.title}</span>
                {t.estimated_min ? (
                  <span className="text-xs text-[var(--color-muted)]">
                    ~{t.estimated_min}m
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm text-[var(--color-muted)]">
          {date} 时间盒（共 {fmtMinutes(totalMinutes)}）
        </h3>

        {selected ? (
          <div className="mb-3 rounded-lg border border-[var(--color-accent)] bg-[var(--color-surface-2)] p-3">
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              已选：{selected.title}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <input
                type="number"
                min={5}
                step={5}
                value={minutes}
                onChange={(e) =>
                  setMinutes(Math.max(5, Number(e.target.value) || 30))
                }
                className="w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <span className="text-xs text-[var(--color-muted)]">分钟</span>
              <button
                onClick={place}
                className="ml-auto rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                放入
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          {boxes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted)]">
              今天还没有时间盒
            </div>
          ) : null}
          {boxes.map((b) => {
            const cat = cats.find((c) => c.id === b.category_id);
            return (
              <div
                key={b.id}
                className="flex items-center gap-2 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-[var(--color-muted)]">
                  {fmtTime(b.planned_start)}
                </span>
                <CategoryPill category={cat ?? null} />
                <span className="flex-1 truncate">{b.title}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {b.planned_minutes}m
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onFinalize}
            disabled={boxes.length === 0}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            完成今日规划
          </button>
        </div>
      </div>
    </div>
  );
}

function Step3Done({
  plan,
  intention,
  boxes,
  cats,
  totalMinutes,
  isToday,
  onConfirm,
}: {
  plan: DailyPlan | null;
  intention: string;
  boxes: Timebox[];
  cats: Category[];
  totalMinutes: number;
  isToday: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const finalized = !!plan?.completed_at;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h3 className="text-base font-medium">规划完成 ✦</h3>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        共 {boxes.length} 个时间盒，{fmtMinutes(totalMinutes)}
        {finalized ? " · 已完成规划" : " · 待确认"}
      </p>
      {intention ? (
        <p className="mt-4 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)] p-3 text-sm">
          <span className="text-xs text-[var(--color-muted)]">今日意图</span>
          <br />
          {intention}
        </p>
      ) : null}
      <div className="mt-5 space-y-1.5">
        {boxes.map((b) => {
          const cat = cats.find((c) => c.id === b.category_id);
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-md bg-[var(--color-surface-2)] px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-[var(--color-muted)]">
                {fmtTime(b.planned_start)}
              </span>
              <CategoryPill category={cat ?? null} />
              <span className="flex-1 truncate">{b.title}</span>
              <span className="text-xs text-[var(--color-muted)]">
                {b.planned_minutes}m
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-[var(--color-muted)]">
          {isToday
            ? "下一步：去「今日」开启第一个时间盒。"
            : "已为该日期排好时间盒。"}
        </p>
        <div className="flex gap-2">
          {!finalized ? (
            <button
              onClick={onConfirm}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm hover:bg-[var(--color-surface-3)]"
            >
              确认完成
            </button>
          ) : null}
          {isToday ? (
            <button
              onClick={async () => {
                await onConfirm();
                navigate("/today");
              }}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              去执行今日 →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function bumpTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
