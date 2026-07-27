import Link from "next/link";
import { getAircraftCatalogEntries } from "@/lib/aircraft-data";
import { APP_STATES } from "@/lib/app-states";
import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "Aircraft Catalog",
  description: "Tracked aircraft catalog and published endurance estimates.",
};

export const dynamic = "force-dynamic";

export default async function AircraftCatalogPage() {
  const catalog = await getAircraftCatalogEntries();
  return (
    <main
      style={{
        maxWidth: 760,
        minHeight: "100dvh",
        margin: "0 auto",
        padding: "28px 18px 160px",
      }}
    >
      <h1 style={{ margin: 0, color: SS_TOKENS.fg0, fontSize: 34 }}>
        Aircraft catalog
      </h1>
      <p style={{ color: SS_TOKENS.fg1, lineHeight: 1.55 }}>
        The tracked fleet, grouped by home state. Endurance figures are
        estimates from catalog performance profiles, not onboard fuel readings.
      </p>

      {APP_STATES.map((state) => {
        const rows = catalog.filter((entry) => entry.homeStateCode === state.code);
        if (rows.length === 0) return null;
        return (
          <section key={state.code} style={{ marginTop: 30 }}>
            <h2 style={{ color: SS_TOKENS.fg0 }}>{state.label}</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map(({ aircraft, nominalEnduranceMin }) => (
                <Link
                  key={aircraft.tail}
                  href={`/plane/${aircraft.tail}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(92px, auto) 1fr auto",
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    background: SS_TOKENS.bg1,
                    border: `.5px solid ${SS_TOKENS.hairline}`,
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <strong className="ss-mono" style={{ color: SS_TOKENS.alert }}>
                    {aircraft.tail}
                  </strong>
                  <span>
                    <strong style={{ display: "block", color: SS_TOKENS.fg0 }}>
                      {aircraft.nickname ?? aircraft.model}
                    </strong>
                    <small style={{ color: SS_TOKENS.fg2 }}>
                      {aircraft.operator} · {aircraft.model}
                    </small>
                  </span>
                  <small className="ss-mono" style={{ color: SS_TOKENS.fg2 }}>
                    {nominalEnduranceMin
                      ? `~${Math.floor(nominalEnduranceMin / 60)}h ${nominalEnduranceMin % 60}m`
                      : "Unverified"}
                  </small>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
