import Link from "next/link";
import {
  isAdminAuthed,
  isAdminPasscodeConfigured,
} from "@/lib/admin-auth";
import { getRegistry } from "@/lib/registry";
import { getTrackSummary } from "@/lib/tracks";
import { SS_TOKENS } from "@/lib/tokens";
import { LoginForm } from "../LoginForm";
import { fmtAgoFromTs } from "./fmt";
import { AdminHeader } from "./AdminHeader";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Out Of Sight · Admin · Tracks",
  robots: { index: false, follow: false },
};

type SP = { error?: string };

export default async function TracksOverviewPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  if (!isAdminPasscodeConfigured()) {
    return <PasscodeMissing />;
  }
  if (!isAdminAuthed()) {
    return <LoginForm error={searchParams.error} next="tracks" />;
  }

  const fleet = await getRegistry();
  const summaries = await Promise.all(
    fleet.map(async (f) => ({
      entry: f,
      summary: await getTrackSummary(f.tail),
    })),
  );

  // Sort: tails with data first (most-recent first), then empties by tail asc.
  summaries.sort((a, b) => {
    const aActive = a.summary.lastSampleTs ?? 0;
    const bActive = b.summary.lastSampleTs ?? 0;
    if (aActive !== bActive) return bActive - aActive;
    return a.entry.tail.localeCompare(b.entry.tail);
  });

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

      <p
        style={{
          fontSize: 12,
          color: SS_TOKENS.fg2,
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        Position-history time-series — sampled every 30 seconds and retained
        in Supabase for one hour while a tail is airborne. Tails with no
        retained samples are dimmed.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>TAIL</Th>
              <Th>NICKNAME</Th>
              <Th>SAMPLES</Th>
              <Th>DAYS</Th>
              <Th>LAST SAMPLE</Th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(({ entry, summary }) => {
              const has = summary.totalSamples > 0;
              const dim = !has;
              const row = (
                <tr
                  style={{
                    borderTop: `.5px solid ${SS_TOKENS.hairline}`,
                    opacity: dim ? 0.5 : 1,
                  }}
                >
                  <Td mono bold>
                    {entry.tail}
                  </Td>
                  <Td>{entry.nickname ?? "—"}</Td>
                  <Td mono dim={!has}>
                    {summary.totalSamples}
                  </Td>
                  <Td mono dim={!has}>
                    {summary.daysWithData}
                  </Td>
                  <Td mono dim={!has}>
                    {fmtAgoFromTs(summary.lastSampleTs) ?? "—"}
                  </Td>
                </tr>
              );
              return has ? (
                <Link
                  key={entry.tail}
                  href={`/admin/tracks/${entry.tail}`}
                  style={{ display: "table-row-group", textDecoration: "none", color: "inherit" }}
                >
                  {row}
                </Link>
              ) : (
                <Disabled key={entry.tail}>{row}</Disabled>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Disabled({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

function PasscodeMissing() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: 32,
        maxWidth: 520,
        margin: "0 auto",
        color: SS_TOKENS.fg1,
        fontSize: 14,
      }}
    >
      <code>ADMIN_PASSCODE</code> isn&rsquo;t set in this environment.
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="ss-mono"
      style={{
        textAlign: "left",
        padding: "10px 8px 8px",
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

function Td({
  children,
  mono,
  bold,
  dim,
}: {
  children: React.ReactNode;
  mono?: boolean;
  bold?: boolean;
  dim?: boolean;
}) {
  return (
    <td
      style={{
        padding: "10px 8px",
        fontSize: 12,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-brand)",
        fontWeight: bold ? 600 : undefined,
        color: dim ? SS_TOKENS.fg2 : SS_TOKENS.fg0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};
