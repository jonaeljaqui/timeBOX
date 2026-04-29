import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listCategories, createTask } from "../lib/db";
import type { Category, Task } from "../lib/types";

interface CaptureCtx {
  open: () => void;
  close: () => void;
}

const Ctx = createContext<CaptureCtx | null>(null);

export function useCapture() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("CaptureProvider missing");
  return ctx;
}

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<number | "">("");
  const [cats, setCats] = useState<Category[]>([]);
  const [recentTask, setRecentTask] = useState<Task | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listCategories().then((c) => {
      setCats(c);
      if (!categoryId && c[0]) setCategoryId(c[0].id);
    });
  }, []);

  const open = useCallback(() => {
    setVisible(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);
  const close = useCallback(() => {
    setVisible(false);
    setTitle("");
    setEstimate("");
    setRecentTask(null);
  }, []);

  // Cmd/Ctrl + N to open capture, Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        open();
      } else if (e.key === "Escape" && visible) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, open, close]);

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    const task = await createTask({
      title: t,
      category_id: categoryId,
      estimated_min: typeof estimate === "number" ? estimate : null,
    });
    setTitle("");
    setEstimate("");
    setRecentTask(task);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {visible ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-32 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-[560px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                快速捕获 · Cmd+N
              </span>
              <span className="text-[10px] text-[var(--color-muted)]">
                Enter 保存 · Esc 关闭
              </span>
            </div>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="想到什么就写下来…"
              className="w-full bg-transparent text-lg outline-none placeholder:text-[var(--color-muted)]"
            />
            <div className="mt-3 flex items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {cats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={
                      categoryId === c.id
                        ? { background: c.color, color: "white" }
                        : {
                            background: `${c.color}26`,
                            color: c.color,
                          }
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
                placeholder="估时(分)"
                value={estimate}
                onChange={(e) =>
                  setEstimate(
                    e.target.value === "" ? "" : Math.max(0, Number(e.target.value))
                  )
                }
                className="ml-auto w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <button
                onClick={submit}
                className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                添加
              </button>
            </div>
            {recentTask ? (
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                已加入收件箱：<span className="text-[var(--color-text)]">{recentTask.title}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
