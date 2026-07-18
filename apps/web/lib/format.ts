/** Formatting helpers shared across the planning app. */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days from today until an ISO date (negative if in the past). */
export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

/** "September 20, 2026" */
export function formatLongDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "Date to be set";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Date to be set";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "Sept 20, 2026" */
export function formatShortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "TBD";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "Tuesday · July 14" for the greeting kicker (today, not the wedding). */
export function todayKicker(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} · ${month} ${d.getDate()}`;
}

/** First name from a full name, falling back to a friendly default. */
export function firstName(full: string | null | undefined): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0] || "there";
}

/** Initial letter (uppercase) for avatars. */
export function initial(name: string | null | undefined): string {
  if (!name) return "•";
  return name.trim().charAt(0).toUpperCase();
}

/** "$3,300" */
export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
