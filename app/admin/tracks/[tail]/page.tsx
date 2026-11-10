import Link from "next/link";
import { notFound } from "next/navigation";
import {
  isAdminAuthed,
  isAdminPasscodeConfigured,
} from "@/lib/admin-auth";
import { getRegistry, fleetHex as fleetHexAlt } from "@/lib/registry-shim";
import {
  listTrackKeys,
  getTracksForDay,
  getTrackSummary,
} from "@/lib/tracks";
import { SS_TOKENS } from "@/lib/tokens";
import { LoginForm } from "../../LoginForm";
import { AdminHeader } from "../AdminHeader";
import {
  humanDate,
  fmtPtTime,
  fmtPtDateTime,
  fmtDuration,
  ktToMph,
} from "../fmt";
import { getTimeFormatPref, isHour12 } from "@/lib/user-prefs";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Out Of Sight · Admin · Tracks",
  robots: { index: false, follow: false },
};

const RECENT_DAYS = 7;
const RECENT_SAMPLES = 50;

type Props = {
  params: { tail: string };
  searchParams: { error?: string };
};

export default async function TailTracksPage({ params, searchParams }: Props) {
  if (!isAdminPasscodeConfigured()) return <Missing />;
  if (!isAdminAuthed()) {
    return <LoginForm error={searchParams.error} next="tracks" />;
  }

  const tail = params.tail.toUpperCase();
  const fleet = await getRegistry();
  const entry = fleet.find((f) => f.tail === tail);
  if (!entry) notFound();

  const [allDates, summary] = await Promise.all([
    listTrackKeys(tail),
    getTrackSummary(tail),
  ]);
  const recentDates = allDates.slice(0, RECENT_DAYS);

  // Pull each recent day's samples so we can show flight time + first/last
  // for each. Done in parallel; at most 7 LRANGE calls.
  const dayBlocks = await Promise.all(
    recentDates.map(async (date) => {
      const samples = await getTracksForDay(tail, date);
      return { date, samples };
    }),
  );
  const hour12 = isHour12(getTimeFormatPref());

  // Recent samples: pull last RECENT_SAMPLES from the most recent day(s).
  const recentSamples: typeof dayBlocks[number]["samples"] = [];
  for (const block of dayBlocks) {
    if (recentSamples.length >= RECENT_SAMPLES) break;
    recentSamples.push(...block.samples);
  }
  recentSamples.sort((a, b) => b.ts - a.ts);
  const tableSamples = recentSamples.slice(0, RECENT_SAMPLES);

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "16px 18px 60px",
        maxWidth: 880,
        margin: "0 auto",
        color: SS_TOKENS.fg0,
      }}
    >
      <AdminHeader active="flights" subtitle="Flights" />

      <section style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            className="ss-mono"
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-.02em",
            }}
          >
            {entry.tail}
          </span>
        </div>
        <div
          className="ss-mono"
          style={{ fontSize: 11, color: SS_TOKENS.fg2, marginTop: 6 }}
        >
          {entry.operator} · {entry.model} · hex {fleetHexAlt(entry).toUpperCase()}
        </div>
      </section>

      <Card>
        <Stat label="TOTAL SAMPLES" value={String(summary.totalSamples)} />
        <Stat label="DAYS WITH DATA" value={String(summary.daysWithData)} />
        <Stat
          label="FIRST SAMPLE"
          value={fmtPtDateTime(summary.firstSampleTs, hour12)}
        />
        <Stat
          label="LAST SAMPLE"
          value={fmtPtDateTime(summary.lastSampleTs, hour12)}
        />
      </Card>

      <SectionTitle>Last {RECENT_DAYS} days</SectionTitle>
      {dayBlocks.length === 0 ? (
        <Empty>No recorded samples for this tail yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dayBlocks.map((b) => {
            const first = b.samples[0];
            const last = b.samples[b.samples.length - 1];
            const duration =
              first && last ? fmtDuration(last.ts - first.ts) : "—";
            return (
              <DayCard key={b.date}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {humanDate(b.date)}
                    </div>
                    <div
                      className="ss-mono"
                      style={{
                        fontSize: 11,
                        color: SS_TOKENS.fg2,
                        marginTop: 2,
                      }}
                    >
                      {b.samples.length} samples · {fmtPtTime(first?.ts, hour12)}
                      {" → "}
                      {fmtPtTime(last?.ts, hour12)} · {duration}
                    </div>
                  </div>
                  {b.samples.length >= 2 && (
                    <Link
                      href={`/admin/tracks/${entry.tail}/${b.date}`}
                      style={mapButtonStyle}
                    >
                      View map →
                    </Link>
                  )}
                </div>
              </DayCard>
            );
          })}
        </div>
      )}

      <SectionTitle>Recent samples (last {RECENT_SAMPLES})</SectionTitle>
      {tableSamples.length === 0 ? (
        <Empty>Nothing to show.</Empty>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>TIME</Th>
                <Th>LAT</Th>
                <Th>LON</Th>
                <Th>ALT</Th>
                <Th>SPD</Th>
                <Th>TRK</Th>
              </tr>
            </thead>
            <tbody>
              {tableSamples.map((p, i) => (
                <tr
                  key={i}
                  style={{
                    borderTop: `.5px solid ${SS_TOKENS.hairline}`,
                  }}
                >
                  <Td mono>{fmtPtDateTime(p.ts, hour12)}</Td>
                  <Td mono>{p.lat.toFixed(4)}</Td>
                  <Td mono>{p.lon.toFixed(4)}</Td>
                  <Td mono>{p.alt != null ? `${p.alt}'` : "—"}</Td>
                  <Td mono>
                    {p.spd != null
                      ? `${(ktToMph(p.spd) ?? 0).toFixed(0)} mph`
                      : "—"}
                  </Td>
                  <Td mono>{p.trk != null ? `${Math.round(p.trk)}°` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Missing() {
  return (
    <main style={{ padding: 32, color: SS_TOKENS.fg1 }}>
      <code>ADMIN_PASSCODE</code> isn&rsquo;t set in this environment.
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 8,
        padding: 14,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 12,
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="ss-mono"
        style={{
          fontSize: 9.5,
          letterSpacing: ".1em",
          color: SS_TOKENS.fg2,
        }}
      >
        {label}
      </div>
      <div
        className="ss-mono"
        style={{
          fontSize: 14,
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="ss-mono"
      style={{
        fontSize: 11,
        letterSpacing: ".12em",
        color: SS_TOKENS.fg2,
        textTransform: "uppercase",
        margin: "20px 0 10px",
      }}
    >
      {children}
    </h2>
  );
}

function DayCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 10,
      }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 10,
        fontSize: 12.5,
        color: SS_TOKENS.fg2,
      }}
    >
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="ss-mono"
      style={{
        textAlign: "left",
        padding: "8px 8px",
        fontSize: 9.5,
        letterSpacing: ".1em",
        color: SS_TOKENS.fg2,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      style={{
        padding: "6px 8px",
        fontSize: 11.5,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-brand)",
        color: SS_TOKENS.fg1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

const mapButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "6px 10px",
  borderRadius: 6,
  background: SS_TOKENS.bg2,
  color: SS_TOKENS.fg0,
  border: `.5px solid ${SS_TOKENS.hairline2}`,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 11.5,
};
