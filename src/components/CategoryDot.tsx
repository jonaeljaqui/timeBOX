import clsx from "clsx";
import type { Category } from "../lib/types";

export function CategoryDot({
  category,
  size = 10,
  className,
}: {
  category?: Category | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={clsx("inline-block rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: category?.color ?? "var(--color-muted)",
      }}
      title={category?.name ?? "未分类"}
    />
  );
}

export function CategoryPill({ category }: { category?: Category | null }) {
  if (!category) {
    return (
      <span className="rounded-full bg-[var(--color-surface-3)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
        未分类
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: `${category.color}26`, color: category.color }}
    >
      {category.name}
    </span>
  );
}
