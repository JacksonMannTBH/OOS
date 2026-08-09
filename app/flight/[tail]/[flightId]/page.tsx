// Public, unauthenticated flight detail page. It keeps the share-friendly URL
// and lightweight chrome, while providing deterministic routes back into the
// aircraft and live-map experience.

import { notFound } from "next/navigation";
import nextDynamic from "next/dynamic";
import { getRegistry } from "@/lib/registry";
import { fleetHex } from "@/lib/seed";
import {
  averageGroundSpeedKt,
  getFlightById,
  parseFlightId,
} from "@/lib/flights";
import { SS_TOKENS } from "@/lib/tokens";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";
import { fmtDurationHuman, formatTs } from "@/lib/time";
import { getTimeFormatPref, isHour12 } from "@/lib/user-prefs";
import { BASE_URL } from "@/lib/config";
import {
  DetailActionLink,
  DetailBreadcrumbs,
  DetailContextNav,
  DetailMapLoading,
  DetailMetricList,
  DetailSectionHeading,
  DetailTechnicalDetails,
  type DetailMetric,
} from "@/components/AircraftDetailUI";
import { DetailShareButton } from "@/components/DetailShareButton";
import type { RecentFlightForTail } from "@/lib/flights";

export const dynamic = "force-dynamic";

const PlaneTrackMap = nextDynamic(() => import("@/components/PlaneTrackMap"), {
  ssr: false,
  loading: () => <DetailMapLoading height={380} />,
});

type Props = {
  params: { tail: string; flightId: string };
};

export async function generateMetadata({ params }: Props) {
  const tail = params.tail.toUpperCase();
  const fleet = await getRegistry();
  const entry = fleet.find((aircraft) => aircraft.tail === tail);
  const niceName = entry?.nickname ? ` “${entry.nickname}”` : "";
  return {
    title: `${tail}${niceName} flight`,
    description: `Flight track for ${tail}${niceName}, captured by Out Of Sight.`,
    openGraph: {
      title: `${tail}${niceName} flight`,
      description: "Aircraft flight track captured by Out Of Sight.",
      url: `${BASE_URL}/flight/${tail}/${params.flightId}`,
      type: "article",
    },
  };
}

export default async function FlightDetailPage({ params }: Props) {
  const tail = params.tail.toUpperCase();
  const fleet = await getRegistry();
  const entry = fleet.find((aircraft) => aircraft.tail === tail);
  if (!entry) notFound();
  if (!parseFlightId(params.flightId)) notFound();

  const flight = await getFlightById(tail, entry.nickname, params.flightId);
  if (!flight) {
    return <MissingFlight tail={tail} flightId={params.flightId} />;
  }

  const { session, points, inProgress } = flight;
  const hour12 = isHour12(getTimeFormatPref());
  const flightPath = `/flight/${entry.tail}/${params.flightId}`;
  const aircraftPath = `/plane/${entry.tail}`;
  const mapPath = `/map?tail=${encodeURIComponent(entry.tail)}`;

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        maxWidth: 720,
        boxSizing: "border-box",
        margin: "0 auto",
        padding: "14px 18px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        color: SS_TOKENS.fg0,
      }}
    >
      <DetailBreadcrumbs
        items={[
          { href: "/aircraft", label: "Aircraft" },
          { href: aircraftPath, label: entry.tail },
          { label: inProgress ? "Current flight" : "Flight detail" },
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
            <span
              style={{
                color: SS_TOKENS.fg1,
                fontSize: "clamp(18px, 4.8vw, 24px)",
                fontWeight: 700,
              }}
            >
              flight
            </span>
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              color: SS_TOKENS.fg1,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {entry.nickname ? `“${entry.nickname}” · ` : ""}
            {entry.operator} · {entry.model}
          </p>
        </div>

        <StatusPill
          kind={inProgress ? "alert" : "clear"}
          label={inProgress ? "IN PROGRESS" : "COMPLETED"}
          sub={`${formatTs(session.start_ts, "date-short")} · ${fmtDurationHuman(
            session.duration_s,
          )}`}
          big
        />
      </header>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {inProgress ? (
          <DetailActionLink href={mapPath} primary>
            View live on Map
          </DetailActionLink>
        ) : (
          <DetailActionLink href={aircraftPath} primary>
            View {entry.tail}
          </DetailActionLink>
        )}
        {inProgress && (
          <DetailActionLink href={aircraftPath}>Aircraft details</DetailActionLink>
        )}
        <DetailShareButton path={flightPath} />
      </div>

      <section
        aria-labelledby="flight-track-heading"
        style={{ display: "grid", gap: 12 }}
      >
        <DetailSectionHeading
          id="flight-track-heading"
          eyebrow="Flight track"
          title={inProgress ? "Live route" : "Recorded route"}
          description={
            inProgress
              ? "The endpoint refreshes while this flight remains active."
              : "Public ADS-B observations from the retained flight session."
          }
        />
        {points.length > 0 ? (
          <PlaneTrackMap
            tail={tail}
            points={points}
            inProgress={inProgress}
            height={380}
          />
        ) : (
          <Card>
            <p
              style={{
                margin: 0,
                padding: "22px 8px",
                color: SS_TOKENS.fg1,
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              This flight has no retained coordinates to draw yet.
            </p>
          </Card>
        )}
      </section>

      <section
        aria-labelledby="flight-summary-heading"
        style={{ display: "grid", gap: 12 }}
      >
        <DetailSectionHeading
          id="flight-summary-heading"
          eyebrow={inProgress ? "Live session" : "Flight session"}
          title="Flight summary"
          description="Times describe the first and last retained ADS-B observations, not official wheels-up or landing times."
        />
        <Card>
          <DetailMetricList items={flightMetrics(flight, hour12)} />
        </Card>
      </section>

      <section
        aria-labelledby="flight-technical-heading"
        style={{ display: "grid", gap: 12 }}
      >
        <DetailSectionHeading
          id="flight-technical-heading"
          eyebrow="Reference"
          title="Technical details"
        />
        <DetailTechnicalDetails summary="Show session identifiers and data notes">
          <DetailMetricList
            items={[
              { label: "Track samples", value: String(session.sample_count) },
              { label: "ICAO24", value: fleetHex(entry).toUpperCase() },
              { label: "Flight ID", value: params.flightId },
              { label: "Source", value: "Public ADS-B observations" },
            ]}
          />
          <p
            style={{
              margin: "4px 0 12px",
              color: SS_TOKENS.fg1,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Reception can be delayed, incomplete, or intermittent. Shared flight
            links remain available only while their underlying session is retained.
          </p>
        </DetailTechnicalDetails>
      </section>

      <DetailContextNav
        links={[
          { href: aircraftPath, label: `${entry.tail} details` },
          { href: "/aircraft", label: "Aircraft catalog" },
          { href: mapPath, label: "Map" },
          { href: "/home", label: "Home" },
        ]}
      />
    </main>
  );
}

function MissingFlight({ tail, flightId }: { tail: string; flightId: string }) {
  const aircraftPath = `/plane/${tail}`;
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        maxWidth: 720,
        boxSizing: "border-box",
        margin: "0 auto",
        padding: "14px 18px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <DetailBreadcrumbs
        items={[
          { href: "/aircraft", label: "Aircraft" },
          { href: aircraftPath, label: tail },
          { label: "Flight unavailable" },
        ]}
      />
      <header style={{ display: "grid", gap: 8 }}>
        <span className="ss-eyebrow">Flight track</span>
        <h1
          style={{
            margin: 0,
            color: SS_TOKENS.fg0,
            fontSize: "clamp(30px, 8vw, 44px)",
            lineHeight: 1.05,
          }}
        >
          Flight not available
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 560,
            color: SS_TOKENS.fg1,
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          This session may have expired, or its track may not have been retained.
          The aircraft page shows the latest activity that is still available.
        </p>
      </header>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <DetailActionLink href={aircraftPath} primary>
          View {tail}
        </DetailActionLink>
        <DetailActionLink href="/aircraft">Aircraft catalog</DetailActionLink>
      </div>
      <DetailTechnicalDetails summary="Show requested flight ID">
        <DetailMetricList items={[{ label: "Flight ID", value: flightId }]} />
      </DetailTechnicalDetails>
      <DetailContextNav
        links={[
          { href: aircraftPath, label: `${tail} details` },
          { href: "/map", label: "Map" },
          { href: "/home", label: "Home" },
        ]}
      />
    </main>
  );
}

function flightMetrics(
  flight: RecentFlightForTail,
  hour12: boolean,
): DetailMetric[] {
  const { session, inProgress } = flight;
  const averageGroundSpeed = averageGroundSpeedKt(flight.points);
  return [
    {
      label: "Started",
      value: formatTs(session.start_ts, "datetime", { hour12 }),
    },
    {
      label: inProgress ? "Latest observation" : "Ended",
      value: formatTs(session.end_ts, "datetime", { hour12 }),
    },
    { label: "Duration", value: fmtDurationHuman(session.duration_s) },
    {
      label: "Average ground speed",
      value:
        averageGroundSpeed != null
          ? `${Math.round(averageGroundSpeed)} kt`
          : "Not reported",
    },
    {
      label: "Maximum altitude",
      value:
        session.max_alt_ft > 0
          ? `${session.max_alt_ft.toLocaleString()}′`
          : "Not reported",
    },
  ];
}
