import { SettingsCard } from "@/components/SettingsCard";
import { SettingsPageShell } from "@/components/SettingsPageShell";
import { SS_TOKENS } from "@/lib/tokens";
import type { CSSProperties, ReactNode } from "react";

export const metadata = {
  title: "Legal & Privacy",
  description:
    "Terms of use, safety limitations, privacy practices, and aircraft data-source disclosures for Out Of Sight.",
};

export const dynamic = "force-static";

const STACK_STYLE: CSSProperties = {
  display: "grid",
  gap: 14,
};

const BODY_STYLE: CSSProperties = {
  margin: 0,
  color: SS_TOKENS.fg1,
  fontSize: 14,
  lineHeight: 1.62,
};

const DIVIDER_STYLE: CSSProperties = {
  height: 1,
  background: SS_TOKENS.hairline,
};

const LINK_STYLE: CSSProperties = {
  minHeight: 52,
  boxSizing: "border-box",
  padding: "8px 0",
  display: "flex",
  alignItems: "center",
  gap: 12,
  color: "inherit",
  textDecoration: "none",
};

export default function LegalPage() {
  return (
    <SettingsPageShell
      eyebrow="Legal"
      title="Legal & privacy"
      description="Terms of use, safety limitations, privacy practices, and aircraft data-source disclosures for Out Of Sight."
    >
      <SettingsCard title="Important safety notice" eyebrow="Read first">
        <div style={STACK_STYLE}>
          <p style={BODY_STYLE}>
            Out Of Sight is an independent hobby project that aggregates public
            aircraft observations and fleet records for general informational
            and recreational awareness. It is not an aviation, navigation,
            air-traffic, collision-avoidance, emergency-response, dispatch, or
            safety-critical service.
          </p>
          <p style={BODY_STYLE}>
            Do not rely on the Service to determine whether an aircraft,
            officer, hazard, or enforcement activity is present or absent, and
            do not view or operate it where doing so would be unsafe or
            unlawful. You remain solely responsible for complying with
            applicable law, operating any vehicle safely, maintaining
            situational awareness, and verifying information through
            authoritative sources.
          </p>
          <LegalSubsection title="Accuracy and availability">
            <p style={BODY_STYLE}>
              ADS-B reception and related data may be delayed, incomplete,
              inaccurate, blocked, unavailable, or associated with the wrong
              aircraft. Positions, altitude, speed, heading, flight status,
              tracks, alerts, predictions, and catalog details may be stale,
              omitted, or incorrect.
            </p>
            <p style={BODY_STYLE}>
              Endurance and fuel values are estimates based on elapsed time and
              published performance assumptions. They are not onboard
              telemetry and do not represent an aircraft&apos;s actual fuel state.
              No aircraft detection, alert delivery, accuracy, or uninterrupted
              availability is guaranteed.
            </p>
          </LegalSubsection>
        </div>
      </SettingsCard>

      <SettingsCard title="Information we process" eyebrow="Privacy">
        <div style={STACK_STYLE}>
          <LegalSubsection title="Location-enabled features">
            <p style={BODY_STYLE}>
              When you grant geolocation permission, location, speed, and
              heading are ordinarily processed in your browser to center the
              map, calculate relative distance, and support Ride mode. Out Of
              Sight does not store that information merely because you use
              those features.
            </p>
            <p style={BODY_STYLE}>
              Map tiles are requested from OpenFreeMap. As with any web
              request, the tile provider and its delivery network receive
              technical request information and may be able to infer the area
              displayed on the map.
            </p>
          </LegalSubsection>

          <div aria-hidden style={DIVIDER_STYLE} />

          <LegalSubsection title="Voluntary spot reports">
            <p style={BODY_STYLE}>
              If a spot-report control is available and you deliberately
              submit a report, the Service receives and stores the submitted
              latitude, longitude, timestamp, and nearby-aircraft information.
              Do not submit a report unless you consent to that processing.
            </p>
          </LegalSubsection>

          <div aria-hidden style={DIVIDER_STYLE} />

          <LegalSubsection title="Takeoff notifications">
            <p style={BODY_STYLE}>
              If you opt in, the Service stores a randomly generated device
              identifier, selected state, browser push endpoint, cryptographic
              delivery keys, and user-agent information solely to manage and
              deliver notifications. The subscription does not include your
              location or speed. Disabling notifications removes the
              corresponding server-side subscription.
            </p>
          </LegalSubsection>

          <div aria-hidden style={DIVIDER_STYLE} />

          <LegalSubsection title="Preferences and request data">
            <p style={BODY_STYLE}>
              Browser storage and first-party cookies remember settings such as
              state, display, Ride mode, notifications, and dismissed prompts.
              Ordinary web requests also disclose technical information,
              including an IP address and browser information, to systems and
              service providers used to operate the Service.
            </p>
            <p style={BODY_STYLE}>
              Out Of Sight does not require rider accounts, does not include
              third-party advertising or per-rider analytics, and does not sell
              rider location or notification-subscription data.
            </p>
          </LegalSubsection>
        </div>
      </SettingsCard>

      <SettingsCard title="Terms of use" eyebrow="Use">
        <div style={STACK_STYLE}>
          <p style={BODY_STYLE}>
            By accessing or using Out Of Sight (the &ldquo;Service&rdquo;),
            you acknowledge and agree to these notices. If you do not agree,
            discontinue use of the Service.
          </p>
          <LegalSubsection title="Lawful personal use">
            <p style={BODY_STYLE}>
              The Service is provided for lawful, personal, non-commercial
              informational use. You may not use it to facilitate unlawful
              conduct, evade or obstruct lawful enforcement, interfere with
              aircraft or communications systems, endanger any person or
              property, compromise the Service, or obtain or redistribute data
              contrary to a third party&apos;s terms.
            </p>
          </LegalSubsection>
          <LegalSubsection title="Disclaimer of warranties">
            <p style={BODY_STYLE}>
              The Service and all information made available through it are
              provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the
              fullest extent permitted by applicable law, all warranties are
              disclaimed, whether express, implied, or statutory, including
              warranties of accuracy, completeness, currency, availability,
              merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
          </LegalSubsection>
          <LegalSubsection title="Limitation of liability">
            <p style={BODY_STYLE}>
              To the fullest extent permitted by applicable law, the project
              operator, maintainers, and contributors shall not be liable for
              any injury, property damage, citation, penalty, data loss, or
              direct, indirect, incidental, special, consequential, exemplary,
              or punitive damages arising from or related to use of, inability
              to use, or reliance upon the Service.
            </p>
          </LegalSubsection>
        </div>
      </SettingsCard>

      <SettingsCard title="Aircraft data & attribution" eyebrow="Sources">
        <div style={STACK_STYLE}>
          <p style={BODY_STYLE}>
            Aircraft observations are retrieved by the Service primarily from
            adsb.fi, with OpenSky Network used as a fallback. The aircraft
            catalog is assembled from publicly available state, county,
            registry, and fleet records. Out Of Sight does not provide access
            to private agency systems or official operational feeds.
          </p>
          <p style={BODY_STYLE}>
            Third-party data and map services remain subject to their own terms
            and may change or cease availability without notice. Out Of Sight
            does not control or warrant their accuracy, availability, content,
            or practices, and nothing on this page grants a license to
            third-party data.
          </p>

          <nav aria-label="Third-party data and map terms">
            <ProviderLink
              href="https://github.com/adsbfi/opendata/blob/main/README.md#terms"
              name="adsb.fi"
              detail="Open Data API terms"
            />
            <div aria-hidden style={DIVIDER_STYLE} />
            <ProviderLink
              href="https://opensky-network.org/about/terms-of-use"
              name="OpenSky Network"
              detail="Terms of use & data license"
            />
            <div aria-hidden style={DIVIDER_STYLE} />
            <ProviderLink
              href="https://openfreemap.org/tos/"
              name="OpenFreeMap"
              detail="Map terms & privacy"
            />
          </nav>

          <p style={{ ...BODY_STYLE, color: SS_TOKENS.fg2, fontSize: 12 }}>
            OpenSky attribution: Schäfer et al., <cite>Bringing Up OpenSky: A
            Large-scale ADS-B Sensor Network for Research</cite>, IPSN 2014.
            Out Of Sight is not affiliated with or endorsed by any data
            provider, government agency, aircraft operator, or manufacturer.
          </p>
        </div>
      </SettingsCard>

      <footer
        style={{
          padding: "2px 4px 0",
          color: SS_TOKENS.fg2,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        Last updated <time dateTime="2026-08-08">August 8, 2026</time>. These
        notices may be revised as the Service changes. Continued use after a
        revision constitutes acceptance of the updated notices.
      </footer>
    </SettingsPageShell>
  );
}

function LegalSubsection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <h3
        style={{
          margin: 0,
          color: SS_TOKENS.fg0,
          fontSize: 14,
          fontWeight: 800,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProviderLink({
  href,
  name,
  detail,
}: {
  href: string;
  name: string;
  detail: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <strong
          style={{
            display: "block",
            color: SS_TOKENS.fg0,
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.25,
          }}
        >
          {name}
        </strong>
        <span
          style={{
            display: "block",
            marginTop: 3,
            color: SS_TOKENS.fg2,
            fontSize: 12,
            lineHeight: 1.35,
          }}
        >
          {detail}
        </span>
      </span>
      <span aria-hidden style={{ color: SS_TOKENS.fg2, fontSize: 18 }}>
        ↗
      </span>
    </a>
  );
}
