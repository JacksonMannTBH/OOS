import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "Legal",
  description: "Disclaimers and data attribution.",
};

export default function LegalPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        // 180 px bottom clears tab bar + iOS install prompt overlay.
        padding: "12px 18px 180px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: 460,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <span className="ss-eyebrow">Out Of Sight · Legal</span>
        <Link
          href="/about"
          className="ss-mono"
          style={{
            fontSize: 11,
            color: SS_TOKENS.fg1,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            padding: "0 8px",
            margin: "-12px -8px",
          }}
        >
          ← Back
        </Link>
      </header>

      <section
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: SS_TOKENS.fg1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <p>
          Out Of Sight is a personal/hobby project. The information shown is
          derived from public ADS-B telemetry — no private feeds, no
          enforcement-tier sources.
        </p>
      </section>

      <DataFlowSection />

      <section
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: SS_TOKENS.fg1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <p>
          Aircraft positions come from{" "}
          <a
            href="https://adsb.fi"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: SS_TOKENS.fg0, textDecoration: "underline" }}
          >
            adsb.fi
          </a>{" "}
          (primary) and{" "}
          <a
            href="https://opensky-network.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: SS_TOKENS.fg0, textDecoration: "underline" }}
          >
            OpenSky Network
          </a>{" "}
          (fallback / historical). Both are anonymous and require attribution,
          provided here and in the app footer.
        </p>
        <p>
          The aircraft catalog is built from publicly available state and
          county fleet records. Catalog corrections are reviewed before they
          are published.
        </p>
        <p>
          No warranty. Don&rsquo;t use this app to evade enforcement — that
          isn&rsquo;t the point. Knowing the bird is up is the same as seeing a
          marked patrol car ahead: ride within the limit and ride well.
        </p>
      </section>
    </main>
  );
}

function DataFlowSection() {
  return (
    <section
      style={{
        fontSize: 14,
        lineHeight: 1.55,
        color: SS_TOKENS.fg1,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h2
        className="ss-eyebrow"
        style={{ margin: 0, color: SS_TOKENS.fg0 }}
      >
        How your data flows
      </h2>
      <p>
        Out Of Sight is a one-way receiver. We listen to public aircraft
        signals and render them on a map. Nothing about you, your phone,
        or your speed leaves your device on its way to anyone — not WSP,
        not the FAA, not us, not third parties.
      </p>
      <p>The detail:</p>

      <DataFlowList
        title="What stays on your device"
        items={[
          "Your location (browser geolocation API, foreground only).",
          "Your speed (computed from your location samples; never sent off-device).",
          "Your alert preferences and quiet-hours settings.",
        ]}
      />

      <DataFlowList
        title="What leaves your device — and where it goes"
        items={[
          <>
            Standard web request metadata (IP, browser) needed to serve the
            page. We don&rsquo;t tie that to a rider profile (we don&rsquo;t
            have rider profiles).
          </>,
          <>
            Aircraft data requests to{" "}
            <span className="ss-mono">adsb.fi</span> and{" "}
            <span className="ss-mono">OpenSky Network</span> — public,
            anonymous, rate-limited. Same requests anyone could make.
          </>,
          <>
            If you opt in to alerts: a push subscription endpoint for your
            browser, stored only so we can deliver the notification you asked
            for. No location or speed travels through it. You can revoke any
            time at{" "}
            <Link
              href="/settings/alerts"
              className="ss-mono"
              style={{ color: SS_TOKENS.fg0, textDecoration: "underline" }}
            >
              /settings/alerts
            </Link>
            .
          </>,
        ]}
      />

      <DataFlowList
        title="What we don't do"
        items={[
          "We don't send your location, your speed, or anything you do in the app to any agency.",
          "We don't have rider accounts, sign-ins, or per-rider analytics.",
          "We don't sell, share, or resell rider data — we don't have rider data to sell.",
          "We don't run a back channel to an agency or operator.",
        ]}
      />

      <p style={{ color: SS_TOKENS.fg2, fontStyle: "italic" }}>
        The data flow is one-way.{" "}
        <span className="ss-mono">Channel 19</span> is one-way too.
      </p>
    </section>
  );
}

function DataFlowList({
  title,
  items,
}: {
  title: string;
  items: React.ReactNode[];
}) {
  return (
    <div>
      <p style={{ margin: "0 0 6px", color: SS_TOKENS.fg0, fontWeight: 600 }}>
        {title}
      </p>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
