import Link from "next/link";
import { notFound } from "next/navigation";
import { fleetHex } from "@/lib/seed";
import { getAircraftCatalogEntries } from "@/lib/aircraft-data";
import { isStateCode, type StateCode } from "@/lib/app-states";
import { getSnapshotForRender } from "@/lib/snapshot";
import { applyMockState, parseMockState } from "@/lib/mock-state";
import {
  averageGroundSpeedKt,
  flightIdFromTs,
  getMostRecentFlightForTail,
} from "@/lib/flights";
import { SS_TOKENS } from "@/lib/tokens";
import { StatusPill } from "@/components/StatusPill";
import { Card } from "@/components/Card";
import { fmtAgo, fmtAgoTs, fmtAloft, formatTs } from "@/lib/time";
import { getTimeFormatPref, isHour12 } from "@/lib/user-prefs";
import type { Aircraft } from "@/lib/types";
import type { RecentFlightForTail } from "@/lib/flights";
import { roleBadgeText } from "@/lib/role-display";
import {
  DetailActionLink,
  DetailBreadcrumbs,
  DetailContextNav,
  DetailMetricList,
  DetailSectionHeading,
  DetailTechnicalDetails,
  type DetailMetric,
} from "@/components/AircraftDetailUI";
import { DetailShareButton } from "@/components/DetailShareButton";

export const dynamic = "force-dynamic";

type Props = {
  params: { tail: string };
  searchParams: { mock?: string; state?: string };
};

export async function generateMetadata({ params }: Props) {
  return { title: params.tail.toUpperCase() };
}

export default async function PlanePage({ params, searchParams }: Props) {
  const tail = params.tail.toUpperCase();
  const catalog = await getAircraftCatalogEntries();
  const catalogEntry = catalog.find((item) => item.aircraft.tail === tail);
  if (!catalogEntry) notFound();

  const entry = catalogEntry.aircraft;
  const stateCode = isStateCode(searchParams.state)
    ? (searchParams.state.toUpperCase() as StateCode)
    : catalogEntry.homeStateCode;
  const [real, recentFlight] = await Promise.all([
    getSnapshotForRender(stateCode),
    getMostRecentFlightForTail(tail, entry.nickname),
  ]);
  const snap = applyMockState(real, parseMockState(searchParams.mock));
  const live = snap.aircraft.find((aircraft) => aircraft.tail === tail);
  const isAirborne = Boolean(live?.airborne);
  const snapshotAgeSec = Math.max(
    0,
    Math.floor((Date.now() - snap.fetched_at) / 1_000),
  );
  const hour12 = isHour12(getTimeFormatPref());
  const flightHref = recentFlight
    ? `/flight/${entry.tail}/${flightIdFromTs(recentFlight.session.start_ts)}`
    : null;
  const mapHref = `/map?tail=${encodeURIComponent(entry.tail)}${
    searchParams.mock ? `&mock=${encodeURIComponent(searchParams.mock)}` : ""
  }`;

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        maxWidth: 720,
        boxSizing: "border-box",
        margin: "0 auto",
        padding: "14px 18px 180px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <DetailBreadcrumbs
        items={[
          { href: "/aircraft", label: "Aircraft" },
          { label: entry.tail },
        ]}
      />

      <header style={{ display: "grid", gap: 10 }}>
        <div>
          <h1
            style={{
              margin: 0,
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              flexWrap: "wrap",
              color: SS_TOKENS.fg0,
              fontSize: "clamp(30px, 8vw, 44px)",
              fontWeight: 850,
              lineHeight: 1.04,
              letterSpacing: 0,
            }}
          >
            <span className="ss-mono">{entry.tail}</span>
            {entry.nickname && (
              <span
                style={{
                  color: SS_TOKENS.fg1,
                  fontSize: "clamp(17px, 4.5vw, 22px)",
                  fontStyle: "italic",
                  fontWeight: 650,
                }}
              >
                &ldquo;{entry.nickname}&rdquo;
              </span>
            )}
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              color: SS_TOKENS.fg1,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {entry.operator} · {entry.model} · {entry.base}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <StatusPill
            kind={isAirborne ? "alert" : "clear"}
            label={isAirborne ? "AIRBORNE" : "GROUNDED"}
            sub={
              isAirborne
                ? fmtAloft(live?.time_aloft_min)
                : recentFlight
                  ? `Last flew ${fmtAgoTs(recentFlight.session.end_ts)}`
                  : live?.last_seen_min != null
                    ? `Last contact ${fmtAgo(live.last_seen_min)}`
                    : "No recent contact"
            }
            big
            style={{ borderRadius: 7, boxShadow: "none" }}
          />
          <span
            className="ss-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: entry.role === "patrol" ? 76 : "auto",
              minWidth: 76,
              height: 36,
              boxSizing: "border-box",
              padding: "0 10px",
              borderRadius: 7,
              background: SS_TOKENS.alertDim,
              border: `1px solid ${SS_TOKENS.hairline2}`,
              color: SS_TOKENS.alert,
              fontSize: 10,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {roleBadgeText(entry.role)}
          </span>
        </div>
      </header>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {isAirborne ? (
          <DetailActionLink href={mapHref} primary>
            View live on Map
          </DetailActionLink>
        ) : flightHref ? (
          <DetailActionLink href={flightHref} primary>
            View latest flight
          </DetailActionLink>
        ) : (
          <DetailActionLink href={mapHref}>Open Map</DetailActionLink>
        )}
        {isAirborne && flightHref && (
          <DetailActionLink href={flightHref}>
            {recentFlight?.inProgress ? "View current flight" : "View latest flight"}
          </DetailActionLink>
        )}
        {flightHref && <DetailShareButton path={flightHref} />}
      </div>

      {isAirborne && live && (
        <section
          aria-labelledby="position-snapshot-heading"
          style={{ display: "grid", gap: 12 }}
        >
          <DetailSectionHeading
            id="position-snapshot-heading"
            title="Position snapshot"
            description={`Captured ${snapshotAgeSec}s before this page loaded. Open Map for the continuously refreshing view.`}
          />
          <Card>
            <DetailMetricList items={liveMetrics(live)} />
          </Card>
        </section>
      )}

      {recentFlight && (
        <section
          aria-labelledby="flight-summary-heading"
          style={{ display: "grid", gap: 12 }}
        >
          <DetailSectionHeading
            id="flight-summary-heading"
            eyebrow={recentFlight.inProgress ? "Current flight" : "Latest flight"}
            title="Flight summary"
          />
          <Card>
            <DetailMetricList
              items={flightMetrics(recentFlight, hour12)}
            />
          </Card>
        </section>
      )}

      {!isAirborne && !recentFlight && (
        <section
          aria-labelledby="no-flight-heading"
          style={{ display: "grid", gap: 12 }}
        >
          <DetailSectionHeading
            id="no-flight-heading"
            eyebrow="Flight history"
            title="No retained flight yet"
          />
          <Card>
            <p
              style={{
                margin: 0,
                color: SS_TOKENS.fg1,
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              A track and flight summary will appear after the next observed
              flight begins.
            </p>
          </Card>
        </section>
      )}

      <section
        aria-labelledby="aircraft-details-heading"
        style={{ display: "grid", gap: 12 }}
      >
        <DetailSectionHeading
          id="aircraft-details-heading"
          eyebrow="Reference"
          title="Aircraft details"
          description={entry.roleDescription}
        />
        <DetailTechnicalDetails summary="Show aircraft and registry details">
          <DetailMetricList
            items={[
              { label: "Operator", value: entry.operator },
              { label: "Model", value: entry.model },
              { label: "Home base", value: entry.base },
              { label: "Home state", value: catalogEntry.homeStateCode },
              {
                label: "Role",
                value: roleBadgeText(entry.role),
                detail:
                  entry.roleNote ??
                  (entry.roleConfidence === "tentative"
                    ? "Best estimate from available public records."
                    : undefined),
              },
              {
                label: "Estimated endurance",
                value: formatEndurance(catalogEntry.nominalEnduranceMin),
                detail: "Catalog estimate, not onboard fuel telemetry.",
              },
              { label: "ICAO24", value: fleetHex(entry).toUpperCase() },
            ]}
          />
          <Link
            href={`https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${entry.tail}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              color: SS_TOKENS.alert,
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Open FAA registry ↗
          </Link>
        </DetailTechnicalDetails>
      </section>

      <DetailContextNav
        links={[
          { href: "/aircraft", label: "Aircraft catalog" },
          { href: mapHref, label: "Map" },
          { href: "/home", label: "Home" },
        ]}
      />
    </main>
  );
}

function liveMetrics(live: Aircraft): DetailMetric[] {
  return [
    {
      label: "Altitude",
      value:
        live.altitude_ft != null
          ? `${live.altitude_ft.toLocaleString()}′`
          : "Not reported",
    },
    {
      label: "Ground speed",
      value:
        live.ground_speed_kt != null
          ? `${Math.round(live.ground_speed_kt)} kt`
          : "Not reported",
    },
    {
      label: "Heading",
      value:
        live.heading != null ? `${Math.round(live.heading)}°` : "Not reported",
    },
    squawkMetric(live.squawk),
  ];
}

function squawkMetric(squawk: string | null | undefined): DetailMetric {
  const emergency =
    squawk === "7700"
      ? { color: SS_TOKENS.danger, detail: "General emergency code." }
      : squawk === "7600"
        ? { color: SS_TOKENS.warn, detail: "Radio communications failure code." }
        : squawk === "7500"
          ? { color: SS_TOKENS.danger, detail: "Hijack code." }
          : null;
  return {
    label: "Squawk",
    value: (
      <span className="ss-mono" style={{ color: emergency?.color }}>
        {squawk ?? "Not reported"}
      </span>
    ),
    detail: emergency?.detail,
  };
}

function flightMetrics(
  flight: RecentFlightForTail,
  hour12: boolean,
): DetailMetric[] {
  const { session, inProgress } = flight;
  const avgGroundSpeed = averageGroundSpeedKt(flight.points);
  return [
    {
      label: "Started",
      value: formatTs(session.start_ts, "datetime", { hour12 }),
    },
    {
      label: inProgress ? "Latest observation" : "Ended",
      value: formatTs(session.end_ts, "datetime", { hour12 }),
    },
    { label: "Duration", value: formatDuration(session.duration_s) },
    {
      label: "Average ground speed",
      value:
        avgGroundSpeed != null ? `${Math.round(avgGroundSpeed)} kt` : "Not reported",
    },
    {
      label: "Maximum altitude",
      value:
        session.max_alt_ft > 0
          ? `${session.max_alt_ft.toLocaleString()}′`
          : "Not reported",
    },
    { label: "Status", value: inProgress ? "In progress" : "Completed" },
  ];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatEndurance(minutes: number | null): string {
  if (!minutes) return "Unverified";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `About ${hours}h ${remainder}m` : `About ${hours}h`;
}
