import { NavLink } from "react-router-dom";
import clsx from "clsx";

const NAV = [
  { to: "/today", label: "今日", hint: "Today" },
  { to: "/inbox", label: "收件箱", hint: "Inbox" },
  { to: "/planner", label: "规划", hint: "15-min planning" },
  { to: "/review", label: "复盘", hint: "Review & stats" },
  { to: "/settings", label: "设置", hint: "Settings" },
];

export function Sidebar() {
  return (
    <nav
      className="flex w-44 flex-col gap-1 border-r border-[var(--color-border-soft)] bg-[var(--color-surface)] py-3"
    >
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            clsx(
              "mx-2 flex items-baseline gap-2 rounded-md px-3 py-2 text-sm transition",
              isActive
                ? "bg-[var(--color-surface-3)] text-[var(--color-text)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
            )
          }
        >
          <span>{item.label}</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider opacity-50">
            {item.hint}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
