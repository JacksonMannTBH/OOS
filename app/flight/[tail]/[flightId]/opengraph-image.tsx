// Generates a 1200×630 social-share card for /flight/[tail]/[flightId].
// Draws the flight polyline directly into the ImageResponse so share
// previews do not depend on a third-party static map image service.
//
// TZ NOTE: dates render in PT and are labelled "PT". OG images are
// rendered once per flight share URL on the server and embedded in
// chat/social previews where the viewer's tz is unknowable. PT is the
// geography the flight actually occurred in — a friend in EDT seeing
// the unfurl learns the local-PT clock time, which is what they'd
// want for "when did this happen?" anyway.

import { ImageResponse } from "next/og";
import { getRegistry } from "@/lib/registry";
import { getFlightById } from "@/lib/flights";
import { fmtDurationHuman, formatTs } from "@/lib/time";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Out Of Sight flight track";

const SS_BG = "#0b0d10";
const SS_FG = "#eef0f3";
const SS_FG2 = "#a8adb6";
const SS_ALERT = "#f6c431";

const MAX_PATH_POINTS = 200;
const TRACK_PAD = 80;

type Props = { params: { tail: string; flightId: string } };

export default async function OGImage({ params }: Props) {
  const tail = params.tail.toUpperCase();
  const fleet = await getRegistry();
  const entry = fleet.find((f) => f.tail === tail) ?? null;
  const flight = entry
    ? await getFlightById(tail, entry.nickname, params.flightId)
    : null;

  const trackArt =
    flight && flight.points.length >= 2
      ? buildTrackArt(flight.points)
      : null;

  const title = entry
    ? entry.nickname
      ? `${tail} · ${entry.nickname}`
      : tail
    : tail;
  const subtitle = flight
    ? `${formatTs(flight.session.start_ts, "date-short")} PT · ${fmtDurationHuman(flight.session.duration_s)}`
    : "Flight track";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: SS_BG,
          color: SS_FG,
          position: "relative",
        }}
      >
        {trackArt && (
          <svg
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.9,
            }}
          >
            <path
              d={trackArt.path}
              fill="none"
              stroke="rgba(245,184,64,0.22)"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={trackArt.path}
              fill="none"
              stroke={SS_ALERT}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={trackArt.start[0]}
              cy={trackArt.start[1]}
              r="10"
              fill="#5DD9A7"
              stroke={SS_BG}
              strokeWidth="4"
            />
            <circle
              cx={trackArt.end[0]}
              cy={trackArt.end[1]}
              r="11"
              fill={SS_ALERT}
              stroke={SS_BG}
              strokeWidth="4"
            />
          </svg>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(11,13,16,0.6) 0%, rgba(11,13,16,0.2) 50%, rgba(11,13,16,0.92) 100%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 64,
            width: "100%",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: SS_ALERT,
              }}
            />
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 1.6,
                color: SS_FG,
              }}
            >
              OUT OF SIGHT
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span
              style={{
                fontSize: 92,
                fontWeight: 800,
                color: SS_FG,
                letterSpacing: -2,
                lineHeight: 1,
              }}
            >
              {title}
            </span>
            <span style={{ fontSize: 28, color: SS_ALERT, fontWeight: 600 }}>
              {subtitle}
            </span>
            {entry && (
              <span style={{ fontSize: 22, color: SS_FG2 }}>
                {entry.operator} · {entry.model}
              </span>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 18, color: SS_FG2 }}>
              LIVE AIRCRAFT
            </span>
            <span style={{ fontSize: 18, color: SS_FG2 }}>
              /flight/{tail}/{params.flightId}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // 1-day CDN cache — completed flights don't change.
        "Cache-Control": "public, max-age=0, s-maxage=86400, immutable",
      },
    },
  );
}

type TrackArt = {
  path: string;
  start: [number, number];
  end: [number, number];
};

function buildTrackArt(points: { lat: number; lon: number }[]): TrackArt | null {
  const stride = Math.max(1, Math.ceil(points.length / MAX_PATH_POINTS));
  const sampled: { lat: number; lon: number }[] = [];
  for (let i = 0; i < points.length; i += stride) {
    sampled.push(points[i]!);
  }
  if (points.length > 0 && sampled[sampled.length - 1] !== points[points.length - 1]) {
    const last = points[points.length - 1]!;
    sampled.push(last);
  }
  const projected = sampled.map((p) => ({
    x: p.lon,
    y: mercatorY(p.lat),
  }));
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX === 0 && spanY === 0) return null;

  const availableW = size.width - TRACK_PAD * 2;
  const availableH = size.height - TRACK_PAD * 2;
  const scale = Math.min(
    spanX > 0 ? availableW / spanX : Number.POSITIVE_INFINITY,
    spanY > 0 ? availableH / spanY : Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(scale) || scale <= 0) return null;

  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const left = (size.width - drawnW) / 2;
  const top = (size.height - drawnH) / 2;
  const screen = projected.map<[number, number]>((p) => [
    left + (p.x - minX) * scale,
    top + (maxY - p.y) * scale,
  ]);
  const path = screen
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  return {
    path,
    start: screen[0]!,
    end: screen[screen.length - 1]!,
  };
}

function mercatorY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

