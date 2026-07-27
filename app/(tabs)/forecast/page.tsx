import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { getForecastGrid } from "@/lib/predictor";
import { ForecastGridView } from "@/components/ForecastGridView";
import { LearningPanel } from "@/components/LearningPanel";
import { getLearningState } from "@/lib/learning";
import { getTimeFormatPref, isHour12 } from "@/lib/user-prefs";
import { getSnapshotForRender } from "@/lib/snapshot";
import { getRegistry } from "@/lib/registry";
import { computeStatus } from "@/lib/status";
import {
  applyMockForecastGrid,
  applyMockLearning,
  applyMockState,
  parseMockState,
} from "@/lib/mock-state";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Out Of Sight · Forecast",
  description: "Weekly probability of fleet takeoffs by hour and day.",
};

const FORECAST_LEARNING_EVENT_FLOOR = 30;

type SP = { mock?: string };

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const mockState = parseMockState(searchParams.mock);
  const [realGrid, realLearning, realSnap, fleet] = await Promise.all([
    getForecastGrid(),
    getLearningState(),
    getSnapshotForRender(),
    getRegistry(),
  ]);
  const grid = applyMockForecastGrid(realGrid, mockState);
  const learning = applyMockLearning(realLearning, mockState);
  const snap = applyMockState(realSnap, mockState);
  const fleetMap = new Map(fleet.map((f) => [f.tail, f]));
  const liveStatus = computeStatus(snap, fleetMap);
  const showLearning =
    learning.stillLearning ||
    grid.total_events < FORECAST_LEARNING_EVENT_FLOOR;
  const hour12 = isHour12(getTimeFormatPref());
  return (
    <main
      style={{
        minHeight: "100dvh",
        // 180 px bottom clears tab bar + iOS install prompt overlay.
        padding: "12px 18px 180px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
          paddingRight: 48,
          gap: 12,
        }}
      >
        <span className="ss-eyebrow">Out Of Sight · Forecast</span>
        <Link
          href="/"
          className="ss-mono"
          style={{ fontSize: 11, color: SS_TOKENS.fg1, textDecoration: "none" }}
        >
          ← Home
        </Link>
      </header>

      {liveStatus.kind === "alert" && (
        <Link
          href="/map"
          aria-label={`Live now: ${liveStatus.pill}. Open map.`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            background: SS_TOKENS.bg1,
            border: `1px solid ${SS_TOKENS.alert}`,
            borderRadius: 12,
            padding: "10px 14px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
            }}
          >
            <span
              className="ss-mono ss-eyebrow"
              style={{ color: SS_TOKENS.alert }}
            >
              LIVE NOW
            </span>
            <span
              className="ss-mono"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SS_TOKENS.fg0,
                letterSpacing: ".02em",
              }}
            >
              {liveStatus.pill}
              {liveStatus.pillSub ? ` · ${liveStatus.pillSub}` : ""}
            </span>
          </span>
          <span
            className="ss-mono"
            style={{
              fontSize: 11,
              color: SS_TOKENS.fg1,
              letterSpacing: ".06em",
              flexShrink: 0,
            }}
          >
            SEE /RADAR →
          </span>
        </Link>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-.02em",
            color: SS_TOKENS.fg0,
            margin: 0,
          }}
        >
          Weekly forecast
        </h1>
        <p
          style={{
            fontSize: 13,
            color: SS_TOKENS.fg1,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Hour-of-week probability of any fleet takeoff, drawn from{" "}
          <span className="ss-mono">{grid.total_events}</span> logged
          takeoff{grid.total_events === 1 ? "" : "s"}. Brighter cells,
          busier hour. Tap a cell to see the regular birds.
        </p>
      </section>

      {showLearning && (
        <LearningPanel
          state={learning}
          eventsSeen={grid.total_events}
          variant="banner"
        />
      )}

      <ForecastGridView grid={grid} hour12={hour12} />
    </main>
  );
}
