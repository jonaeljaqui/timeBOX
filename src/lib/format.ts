import { format, parseISO } from "date-fns";

export function todayISO(): string {
  const d = new Date();
  return format(d, "yyyy-MM-dd");
}

export function fmtClock(secs: number): string {
  const sign = secs < 0 ? "+" : "";
  const a = Math.abs(secs);
  const m = Math.floor(a / 60);
  const s = a % 60;
  return `${sign}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function fmtTime(iso: string): string {
  return format(parseISO(iso), "HH:mm");
}

export function fmtDate(iso: string): string {
  return format(parseISO(iso), "MM-dd");
}

export function fmtFullDate(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd HH:mm");
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} 小时` : `${h}h ${m}m`;
}

export function isoForLocalDateTime(date: string, time: string): string {
  // date = YYYY-MM-DD, time = HH:MM, builds local-time ISO without TZ shift surprises.
  const d = new Date(`${date}T${time}:00`);
  return d.toISOString();
}

export function startOfDayISO(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toISOString();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}
