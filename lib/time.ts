// Canonical time-display formatter. One source of truth so per-page
// helpers don't drift on tz, format, or 24-hour invariants.
//
// The initial audience is Pacific-time only. Every displayed time is
// rendered in PT; time-bearing styles get an explicit "PT" suffix so a
// rider in any tz can read the value without guessing. Date-only styles
// don't get the suffix — a date is a date.
//
// Brand voice (design/BRAND.md §3): 24-hour clock, mono numerics, no AM/PM.

export const PT_TZ = "America/Los_Angeles";

export type FormatStyle =
  | "time"
  | "time-sec"
  | "date"
  | "date-short"
  | "date-weekday"
  | "datetime"
  | "hour-min"
  | "iso-utc";

const TIME_BEARING: ReadonlySet<FormatStyle> = new Set([
  "time",
  "time-sec",
  "datetime",
  "hour-min",
]);

export type FormatOpts = {
  /** Render as 12-hour with AM/PM. Default false (24-hour, brand default). */
  hour12?: boolean;
};

function timeOpts(hour12: boolean): Intl.DateTimeFormatOptions {
  return hour12
    ? { hour: "numeric", minute: "2-digit", hour12: true, timeZone: PT_TZ }
    : { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: PT_TZ };
}

function timeSecOpts(hour12: boolean): Intl.DateTimeFormatOptions {
  return hour12
    ? {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: PT_TZ,
      }
    : {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: PT_TZ,
      };
}

export function formatTs(
  tsMs: number | null | undefined,
  style: FormatStyle,
  opts?: FormatOpts,
): string {
  if (tsMs == null || Number.isNaN(tsMs)) return "—";
  const d = new Date(tsMs);
  const hour12 = opts?.hour12 ?? false;
  let out: string;
  switch (style) {
    case "time":
    case "hour-min":
      out = d.toLocaleTimeString([], timeOpts(hour12));
      break;
    case "time-sec":
      out = d.toLocaleTimeString([], timeSecOpts(hour12));
      break;
    case "date":
      // sv-SE forces ISO-style YYYY-MM-DD regardless of viewer locale.
      out = d.toLocaleDateString("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: PT_TZ,
      });
      break;
    case "date-short":
      out = d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        timeZone: PT_TZ,
      });
      break;
    case "date-weekday":
      out = d.toLocaleDateString([], {
        weekday: "long",
        timeZone: PT_TZ,
      });
      break;
    case "datetime": {
      const date = formatTs(tsMs, "date");
      const time = d.toLocaleTimeString([], timeOpts(hour12));
      return `${date} ${time} PT`;
    }
    case "iso-utc":
      return d.toISOString();
  }
  return TIME_BEARING.has(style) ? `${out} PT` : out;
}

/** Same instant, no PT suffix. For composing custom strings (e.g. ranges). */
export function formatTsBare(
  tsMs: number | null | undefined,
  style: FormatStyle,
  opts?: FormatOpts,
): string {
  if (tsMs == null || Number.isNaN(tsMs)) return "—";
  return formatTs(tsMs, style, opts).replace(/\s+PT$/, "");
}

/**
 * Pacific-anchored "now" hour-of-week. Used by the forecast grid to
 * highlight the current cell.
 */
export function pacificNow(): { dow: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(new Date());
  let hourStr: string | null = null;
  let weekdayStr: string | null = null;
  for (const p of parts) {
    if (p.type === "hour") hourStr = p.value;
    if (p.type === "weekday") weekdayStr = p.value;
  }
  const hour = Number(hourStr ?? 0) % 24;
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = weekdayStr ? (dowMap[weekdayStr] ?? 0) : 0;
  return { dow, hour };
}

/** "Just now" / "Xm ago" / "Xh ago" / "Xd ago" — tz-agnostic. */
export function fmtAgo(min: number | null | undefined): string {
  if (min == null || Number.isNaN(min) || min <= 0) return "a while";
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.floor(min / 60)}h ago`;
  return `${Math.floor(min / 1440)}d ago`;
}

/** Same as fmtAgo, but takes an absolute timestamp instead of pre-computed minutes. */
export function fmtAgoTs(tsMs: number | null | undefined): string {
  if (tsMs == null || Number.isNaN(tsMs)) return "a while";
  const sec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
  if (sec < 60) return "just now";
  return fmtAgo(Math.floor(sec / 60));
}

/** "Today" / "Yesterday" / weekday / short date — PT-anchored. */
export function fmtRelativeDay(tsMs: number): string {
  const dayKey = (d: Date) =>
    d.toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: PT_TZ,
    });
  const target = new Date(tsMs);
  const now = new Date();
  const targetDay = dayKey(target);
  const todayDay = dayKey(now);
  const yestDay = dayKey(new Date(now.getTime() - 86_400_000));
  if (targetDay === todayDay) return "Today";
  if (targetDay === yestDay) return "Yesterday";
  const daysApart = Math.abs(now.getTime() - target.getTime()) / 86_400_000;
  if (daysApart < 7) return formatTs(tsMs, "date-weekday");
  return formatTs(tsMs, "date-short");
}

/** "MM:SS" or "HH:MM:SS" — clock-style duration for precision contexts. */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h === 0) {
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** "47m" / "3h 45m" — human-readable duration for narrative contexts. */
export function fmtDurationHuman(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** "47m aloft" / "3h 12m aloft" — tz-agnostic. */
export function fmtAloft(min: number | null | undefined): string {
  if (min == null) return "—";
  if (min < 60) return `${min}m aloft`;
  return `${Math.floor(min / 60)}h ${min % 60}m aloft`;
}
