export type TimeFormat = "24" | "12";
export const DEFAULT_TIME_FORMAT: TimeFormat = "12";

export function parseTimeFormat(value: unknown): TimeFormat {
  return value === "24" || value === "12" ? value : DEFAULT_TIME_FORMAT;
}
