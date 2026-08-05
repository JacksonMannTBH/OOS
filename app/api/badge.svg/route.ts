// Public, embeddable status pill — 140×24 SVG. Drop-in for marketing
// pages, README badges, etc. Drives off the same computeStatus() as
// the home page so the badge text never disagrees with the app.

import { computeStatus } from "@/lib/status";
import { peekHealthSnapshot } from "@/lib/snapshot";
import { getRegistry } from "@/lib/registry";
import type { FleetEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FG = "#F2F4F7";
const BG = "#15181D";
const STROKE = "#262B33";
const ALERT = "#f6c431";
const CLEAR = "#5DD9A7";
const STALE = "#6B7380";

const STALE_AFTER_MS = 90 * 1000;

function escape(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&#39;",
  );
}

export async function GET() {
  const snap = await peekHealthSnapshot();
  const registry = await getRegistry();
  const fleetMap = new Map<string, FleetEntry>(registry.map((f) => [f.tail, f]));

  let label: string;
  let dot: string;

  if (!snap) {
    label = "BIRD ? · — up";
    dot = STALE;
  } else if (Date.now() - snap.fetched_at > STALE_AFTER_MS) {
    label = "BIRD ? · — up";
    dot = STALE;
  } else {
    const status = computeStatus(snap, fleetMap);
    const count = status.alertCount;
    if (status.kind === "alert") {
      // Every airborne tracked aircraft reads BIRD UP on the pill.
      label = `${status.pill} · ${count} up`;
      dot = ALERT;
    } else {
      label = `ALL CLEAR · ${count} up`;
      dot = CLEAR;
    }
  }

  const W = 140;
  const H = 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Out Of Sight status: ${escape(label)}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="11.5" ry="11.5" fill="${BG}" stroke="${STROKE}" />
  <circle cx="12" cy="12" r="3.4" fill="${dot}">
    <animate attributeName="opacity" values="1;0.45;1" dur="1.6s" repeatCount="indefinite" />
  </circle>
  <text x="22" y="16" font-family="Math Bold, Cambria Math, STIX Two Math, serif" font-size="10.5" font-weight="700" fill="${FG}" letter-spacing="0">${escape(label)}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=30, s-maxage=30",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
