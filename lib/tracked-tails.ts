import { ADDITIONAL_TRACKED_TAILS } from "./aircraft-directory";

export const TRACKED_TAILS = [
  "N102LP",
  "N207HB",
  "N2446X",
  "N305DK",
  "N305RC",
  "N3532K",
  "N407KS",
  "N411KS",
  "N67817",
  "N67880",
  "N78906",
  "N790RJ",
  "N71KP",
  "N815SC",
  "N9446P",
  "N422CT",
  "N509DV",
  "N1977G",
  "N2108J",
  "CGNR6594",
  ...ADDITIONAL_TRACKED_TAILS,
] as const;

const TRACKED_ORDER = new Map<string, number>(
  TRACKED_TAILS.map((tail, index) => [tail, index]),
);

export const TRACKED_TAIL_SET: ReadonlySet<string> = new Set(TRACKED_TAILS);

export function normalizeTail(tail: string | null | undefined): string {
  return (tail ?? "").trim().toUpperCase();
}

export function isTrackedTail(tail: string | null | undefined): boolean {
  return TRACKED_TAIL_SET.has(normalizeTail(tail));
}

export function trackedTailOrder(tail: string | null | undefined): number {
  return TRACKED_ORDER.get(normalizeTail(tail)) ?? Number.MAX_SAFE_INTEGER;
}
