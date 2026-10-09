import { refresh } from "./navigation";
export type TimeFormat = "24" | "12";
export type ContrastMode = "normal" | "high";
export const TIME_FORMAT_COOKIE = "ss_time_format";
export const CONTRAST_COOKIE = "ss_contrast";
export const DEFAULT_TIME_FORMAT: TimeFormat = "24";
export const DEFAULT_CONTRAST: ContrastMode = "normal";
export function getTimeFormatPref(): TimeFormat { return localStorage.getItem(TIME_FORMAT_COOKIE) === "12" ? "12" : "24"; }
export function getContrastPref(): ContrastMode { return localStorage.getItem(CONTRAST_COOKIE) === "high" ? "high" : "normal"; }
export const isHour12 = (format: TimeFormat) => format === "12";
export async function setTimeFormatAction(data: FormData) { localStorage.setItem(TIME_FORMAT_COOKIE, data.get("format") === "12" ? "12" : "24"); refresh(); }
export async function setContrastAction(data: FormData) { localStorage.setItem(CONTRAST_COOKIE, data.get("contrast") === "high" ? "high" : "normal"); document.body.dataset.contrast = getContrastPref(); refresh(); }
export async function resetPreferenceCookiesAction() { localStorage.removeItem(TIME_FORMAT_COOKIE); localStorage.removeItem(CONTRAST_COOKIE); document.body.dataset.contrast = "normal"; }
