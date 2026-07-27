// Public, unauthenticated flight share page. /flight/[tail]/[flightId]
// renders the polyline + metadata for a single completed flight session.
// Lives OUTSIDE the (tabs) group on purpose — no bottom nav, no
// rider-screen chrome, social-friendly canonical URL.

import { notFound } from "next/navigation";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { getRegistry } from "@/lib/registry";
import { fleetHex } from "@/lib/seed";
import {
  averageGroundSpeedKt,
  getFlightById,
  parseFlightId,
} from "@/lib/flights";
import { SS_TOKENS } from "@/lib/tokens";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { fmtDurationHuman, formatTs } from "@/lib/time";
import { getTimeFormatPref, isHour12 } from "@/lib/user-prefs";
import { BASE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

const PlaneTrackMap = nextDynamic(() => import("@/components/PlaneTrackMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 320,
        background: SS_TOKENS.bg0,
        borderRadius: 12,
      }}
    />
  ),
});

type Props = {
  params: { tail: string; flightId: string };
};

export async function generateMetadata({ params }: Props) {
  const tail = params.tail.toUpperCase();
  const fleet = await getRegistry();
  const entry = fleet.find((f) => f.tail === tail);
  const niceName = entry?.nickname ? ` "${entry.nickname}"` : "";
  return {
    title: `${tail}${niceName} · Flight ${params.flightId} · Out Of Sight`,
    description: `Flight track for ${tail}${niceName}, captured by Out Of Sight.`,
    openGraph: {
      title: `${tail}${niceName} · Flight ${params.flightId}`,
      description: `Flight track captured by Out Of Sight.`,
      url: `${BASE_URL}/flight/${tail}/${params.flightId}`,
      type: "article",
    },
  };
}

export default async function FlightSharePage({ params }: Props) {
  const tail = params.tail.toUpperCase();
  const fleet = await getRegistry();
  const entry = fleet.find((f) => f.tail === tail);
  if (!entry) notFound();

  const parsed = parseFlightId(params.flightId);
  if (!parsed) notFound();

  const flight = await getFlightById(tail, entry.nickname, params.flightId);
  if (!flight) {
    return <Missing tail={tail} />;
  }

  const { session, points } = flight;
  const hour12 = isHour12(getTimeFormatPref());
  const avgGroundSpeed = averageGroundSpeedKt(points);

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "16px 18px 40px",
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        color: SS_TOKENS.fg0,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              className="ss-mono"
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: SS_TOKENS.fg0,
                letterSpacing: "-.02em",
              }}
            >
              {entry.tail}
            </span>
            {entry.nickname && (
              <span
                style={{
                  fontSize: 14,
                  color: SS_TOKENS.fg1,
                  fontStyle: "italic",
                }}
              >
                &ldquo;{entry.nickname}&rdquo;
              </span>
            )}
          </div>
          <div
            className="ss-mono"
            style={{
              fontSize: 11,
              color: SS_TOKENS.fg2,
              marginTop: 4,
              letterSpacing: ".04em",
            }}
          >
            {entry.operator} · {entry.model}
          </div>
        </div>
        <ShareLinkButton
          path={`/flight/${entry.tail}/${params.flightId}`}
          label="Copy share link"
        />
      </header>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 11px",
          borderRadius: 999,
          background: SS_TOKENS.alertDim,
          border: `.5px solid color-mix(in srgb, ${SS_TOKENS.alert} 34%, transparent)`,
          color: SS_TOKENS.alert,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".04em",
          alignSelf: "flex-start",
        }}
      >
        Completed flight · {formatTs(session.start_ts, "date-short")} ·{" "}
        {fmtDurationHuman(session.duration_s)}
      </div>

      <PlaneTrackMap tail={tail} points={points} inProgress={false} height={320} />

      <section
        style={{
          background: SS_TOKENS.bg1,
          border: `.5px solid ${SS_TOKENS.hairline}`,
          borderRadius: 12,
          padding: "16px 18px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <KV label="FIRST SEEN" value={formatTs(session.start_ts, "datetime", { hour12 })} />
          <KV label="LAST SEEN" value={formatTs(session.end_ts, "datetime", { hour12 })} />
          <KV label="DURATION" value={fmtDurationHuman(session.duration_s)} />
          <KV label="SAMPLES" value={String(session.sample_count)} />
          <KV
            label="AVG GS"
            value={avgGroundSpeed != null ? `${Math.round(avgGroundSpeed)} kt` : "—"}
          />
          <KV
            label="MAX ALT"
            value={
              session.max_alt_ft > 0
                ? `${session.max_alt_ft.toLocaleString()}′`
                : "—"
            }
          />
          <KV
            label="HEX"
            value={fleetHex(entry).toUpperCase()}
          />
        </div>
      </section>

      <footer
        className="ss-mono"
        style={{
          marginTop: 8,
          fontSize: 11,
          color: SS_TOKENS.fg2,
          letterSpacing: ".04em",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Tracked by{" "}
        <Link
          href="/"
          style={{ color: SS_TOKENS.fg1, textDecoration: "underline" }}
        >
          Out Of Sight
        </Link>
        <br />
        <Link
          href="/"
          style={{ color: SS_TOKENS.fg1, textDecoration: "underline" }}
        >
          View live tracker →
        </Link>
      </footer>
    </main>
  );
}

function Missing({ tail }: { tail: string }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: 32,
        maxWidth: 480,
        margin: "0 auto",
        color: SS_TOKENS.fg1,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <h1
        style={{
          fontSize: 22,
          color: SS_TOKENS.fg0,
          fontWeight: 700,
          margin: 0,
        }}
      >
        Flight not available
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.5 }}>
        This flight is no longer in our window. We keep flight tracks for
        the most recent 30 days and prune older ones to keep storage
        light.
      </p>
      <Link
        href={`/plane/${tail}`}
        className="ss-mono"
        style={{
          fontSize: 12,
          color: SS_TOKENS.alert,
          textDecoration: "underline",
        }}
      >
        See {tail}&rsquo;s recent activity →
      </Link>
    </main>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: SS_TOKENS.bg2,
        padding: "10px 12px",
        borderRadius: 8,
      }}
    >
      <div
        className="ss-mono"
        style={{ fontSize: 9.5, color: SS_TOKENS.fg2, letterSpacing: ".1em" }}
      >
        {label}
      </div>
      <div
        className="ss-mono"
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: SS_TOKENS.fg0,
          marginTop: 3,
        }}
      >
        {value}
      </div>
    </div>
  );
}

