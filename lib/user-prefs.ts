// Server-side reader for per-rider display preferences. Cookies are the
// transport so the SAME render path (server + client) sees the same value
// — no SSR/CSR divergence. Mirrors the simplicity of the rest of the app:
// no auth, no DB, just a cookie.

import { cookies } from "next/headers";
import { parseTimeFormat, type TimeFormat } from "./time-format";
export { DEFAULT_TIME_FORMAT, type TimeFormat } from "./time-format";

export const TIME_FORMAT_COOKIE = "ss_time_format";

/** Read the rider's preferred time format. Server Components only. */
export function getTimeFormatPref(): TimeFormat {
  const v = cookies().get(TIME_FORMAT_COOKIE)?.value;
  return parseTimeFormat(v);
}

export function isHour12(pref: TimeFormat): boolean {
  return pref === "12";
}

// Contrast variant. We do NOT ship light mode — high-contrast stays
// dark, just lifts secondary text + hairline opacity so WCAG-AAA-leaning
// riders (or daytime-glare conditions) read the meta lines and dividers
// reliably. Stored via the same cookie pattern as TIME_FORMAT_COOKIE so
// the SSR/CSR rendered HTML stays identical.
export const CONTRAST_COOKIE = "ss_contrast";
export type ContrastMode = "normal" | "high";
export const DEFAULT_CONTRAST: ContrastMode = "normal";

/** Read the rider's preferred contrast mode. Server Components only. */
export function getContrastPref(): ContrastMode {
  const v = cookies().get(CONTRAST_COOKIE)?.value;
  return v === "high" ? "high" : DEFAULT_CONTRAST;
}
