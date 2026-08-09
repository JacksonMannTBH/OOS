import Link from "next/link";
import { getAircraftCatalogEntries } from "@/lib/aircraft-data";
import { APP_STATES } from "@/lib/app-states";

export const metadata = {
  title: "Aircraft Catalog",
  description: "Tracked aircraft catalog and published endurance estimates.",
};

export const dynamic = "force-dynamic";

export default async function AircraftCatalogPage() {
  const catalog = await getAircraftCatalogEntries();

  return (
    <main className="ss-catalog-page">
      <style>{`
        .ss-catalog-page {
          width: 100%;
          max-width: 720px;
          min-height: 100dvh;
          margin: 0 auto;
          padding: 18px 18px 180px;
        }

        .ss-catalog-context {
          min-height: 44px;
          margin: -8px -8px 4px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .ss-catalog-back {
          min-height: 44px;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          color: var(--ss-fg1);
          font-size: 13px;
          text-decoration: none;
        }

        .ss-catalog-header {
          max-width: 620px;
        }

        .ss-catalog-title {
          margin: 0;
          color: var(--ss-fg0);
          font-size: clamp(30px, 7vw, 38px);
          font-weight: 850;
          line-height: 1.08;
          letter-spacing: 0;
        }

        .ss-catalog-intro {
          margin: 10px 0 0;
          color: var(--ss-fg1);
          font-size: 14px;
          line-height: 1.55;
        }

        .ss-catalog-groups {
          margin-top: 28px;
          display: flex;
          flex-direction: column;
          gap: 26px;
        }

        .ss-catalog-section-header {
          margin: 0 4px 9px;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
        }

        .ss-catalog-section-title {
          margin: 0;
          color: var(--ss-fg0);
          font-size: 18px;
          font-weight: 800;
          line-height: 1.2;
        }

        .ss-catalog-count {
          color: var(--ss-fg2);
          font-size: 10.5px;
          letter-spacing: .06em;
          white-space: nowrap;
        }

        .ss-catalog-list {
          margin: 0;
          padding: 0;
          overflow: hidden;
          list-style: none;
          background: var(--ss-surface);
          border: 1px solid var(--ss-hairline);
          border-radius: 16px;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .ss-catalog-item + .ss-catalog-item {
          border-top: 1px solid var(--ss-hairline);
        }

        .ss-catalog-row {
          min-height: 78px;
          padding: 14px 16px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px;
          color: inherit;
          text-decoration: none;
        }

        .ss-catalog-copy {
          min-width: 0;
        }

        .ss-catalog-primary {
          display: flex;
          align-items: baseline;
          gap: 9px;
          flex-wrap: wrap;
        }

        .ss-catalog-tail {
          color: var(--ss-alert);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: .02em;
        }

        .ss-catalog-name {
          min-width: 0;
          overflow: hidden;
          color: var(--ss-fg0);
          font-size: 15px;
          font-weight: 800;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ss-catalog-meta {
          margin-top: 7px;
          display: flex;
          gap: 6px 14px;
          flex-wrap: wrap;
          color: var(--ss-fg1);
          font-size: 12px;
          line-height: 1.35;
        }

        .ss-catalog-meta-item {
          min-width: 0;
          display: inline-flex;
          gap: 5px;
        }

        .ss-catalog-label {
          color: var(--ss-fg2);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .ss-catalog-rail {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ss-catalog-endurance {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
          white-space: nowrap;
        }

        .ss-catalog-endurance-value {
          color: var(--ss-fg1);
          font-size: 12px;
          font-weight: 700;
        }

        .ss-catalog-chevron {
          color: var(--ss-fg2);
          font-size: 22px;
          font-weight: 400;
          line-height: 1;
        }

        @media (hover: hover) {
          .ss-catalog-row:hover {
            background: var(--ss-bg2);
          }
        }

        @media (max-width: 520px) {
          .ss-catalog-page {
            padding-right: 14px;
            padding-left: 14px;
          }

          .ss-catalog-row {
            padding: 14px;
            gap: 10px;
          }

          .ss-catalog-meta {
            flex-direction: column;
            gap: 3px;
          }

          .ss-catalog-rail {
            gap: 8px;
          }
        }

        @media (max-width: 360px) {
          .ss-catalog-endurance .ss-catalog-label {
            display: none;
          }

          .ss-catalog-name {
            white-space: normal;
          }
        }
      `}</style>

      <div className="ss-catalog-context">
        <span className="ss-eyebrow">Reference</span>
        <Link href="/settings" className="ss-catalog-back">
          &larr; Settings
        </Link>
      </div>

      <header className="ss-catalog-header">
        <h1 className="ss-catalog-title">Tracked aircraft</h1>
        <p className="ss-catalog-intro">
          Browse the published fleet by home state. Endurance is estimated from
          public performance profiles, not onboard fuel readings.
        </p>
      </header>

      <div className="ss-catalog-groups">
        {APP_STATES.map((state) => {
          const rows = catalog.filter(
            (entry) => entry.homeStateCode === state.code,
          );
          if (rows.length === 0) return null;
          const headingId = `catalog-${state.id}`;

          return (
            <section key={state.code} aria-labelledby={headingId}>
              <div className="ss-catalog-section-header">
                <h2 id={headingId} className="ss-catalog-section-title">
                  {state.label}
                </h2>
                <span className="ss-mono ss-catalog-count">
                  {rows.length} aircraft
                </span>
              </div>

              <ul className="ss-catalog-list">
                {rows.map(({ aircraft, nominalEnduranceMin }) => {
                  const endurance = nominalEnduranceMin
                    ? `~${Math.floor(nominalEnduranceMin / 60)}h ${nominalEnduranceMin % 60}m`
                    : "Unverified";

                  return (
                    <li key={aircraft.tail} className="ss-catalog-item">
                      <Link
                        href={`/plane/${aircraft.tail}`}
                        className="ss-catalog-row"
                        aria-label={`View ${aircraft.nickname ?? aircraft.tail} aircraft profile`}
                      >
                        <span className="ss-catalog-copy">
                          <span className="ss-catalog-primary">
                            <span className="ss-mono ss-catalog-tail">
                              {aircraft.tail}
                            </span>
                            <span className="ss-catalog-name">
                              {aircraft.nickname ?? aircraft.model}
                            </span>
                          </span>
                          <span className="ss-catalog-meta">
                            <span className="ss-catalog-meta-item">
                              <span className="ss-catalog-label">Operator</span>
                              <span>{aircraft.operator}</span>
                            </span>
                            <span className="ss-catalog-meta-item">
                              <span className="ss-catalog-label">Model</span>
                              <span>{aircraft.model}</span>
                            </span>
                          </span>
                        </span>

                        <span className="ss-catalog-rail">
                          <span className="ss-catalog-endurance">
                            <span className="ss-catalog-label">
                              Est. endurance
                            </span>
                            <span className="ss-mono ss-catalog-endurance-value">
                              {endurance}
                            </span>
                          </span>
                          <span className="ss-catalog-chevron" aria-hidden>
                            &rsaquo;
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
