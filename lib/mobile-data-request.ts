export type MobileDataRequest =
  | { kind: "catalog" | "forecast" | "settings" }
  | { kind: "recent-flight"; tail: string }
  | { kind: "flight"; tail: string; flightId: string };

// Only the same public data used by the aircraft, flight, and forecast pages.
export function parseMobileDataRequest(url: string): MobileDataRequest | null {
  const p = new URL(url).searchParams;
  const kind = p.get("kind");
  if (kind === "catalog" || kind === "forecast" || kind === "settings") return { kind };
  const tail = p.get("tail")?.trim().toUpperCase();
  if (!tail || !/^[A-Z0-9]{2,12}$/.test(tail)) return null;
  if (kind === "recent-flight") return { kind, tail };
  const flightId = p.get("flightId");
  if (kind === "flight" && flightId && /^\d{8}T\d{4}$/.test(flightId)) {
    return { kind, tail, flightId };
  }
  return null;
}
