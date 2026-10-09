import { SettingsPageShell } from "@/components/SettingsPageShell";
import type { ReactNode } from "react";

export const metadata = {
  title: "Legal & Privacy",
  description: "How Out Of Sight handles safety, privacy, and third-party data.",
};

export const dynamic = "force-static";

const PROVIDERS = [
  {
    name: "FAA Aircraft Registry",
    detail: "Public aircraft registration and ownership records",
    href: "https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download",
  },
  {
    name: "adsb.fi",
    detail: "Primary aircraft observations",
    href: "https://github.com/adsbfi/opendata/blob/main/README.md#terms",
  },
  {
    name: "OpenSky Network",
    detail: "Fallback aircraft observations",
    href: "https://opensky-network.org/about/terms-of-use",
  },
  {
    name: "OpenFreeMap",
    detail: "Map tiles and styles",
    href: "https://openfreemap.org/privacy/",
  },
] as const;

export default function LegalPage() {
  return (
    <SettingsPageShell
      title="Legal & privacy"
      description="Plain-language rules for using Out Of Sight and a clear account of what happens to your data."
    >
      <LegalSection id="safety" title="Use it safely">
        <p>
          Out Of Sight is an independent hobby project. It is not an official
          aviation feed, navigation aid, traffic service, collision-warning
          system, emergency service, or law-enforcement dispatch tool.
        </p>
        <p>
          Aircraft observations can be late, incomplete, blocked, duplicated,
          or wrong. A missing aircraft does not prove the sky is clear. Flight
          paths, takeoff alerts, headings, speeds, and status labels can also be
          delayed or unavailable.
        </p>
        <p>
          Fuel and endurance displays are estimates based on elapsed time and
          published performance assumptions—not onboard telemetry. Never make a
          safety, travel, or legal decision based only on this app. Do not view
          or operate it while doing so would be unsafe or unlawful.
        </p>
      </LegalSection>

      <LegalSection id="privacy" title="What the app handles">
        <p>
          <strong>Effective October 8, 2026.</strong> Out Of Sight is operated
          by Jackson Mann. For privacy questions or deletion requests, email{" "}
          <a href="mailto:jacksonmann253@gmail.com">
            jacksonmann253@gmail.com
          </a>
          .
        </p>
        <PrivacyRow title="Live location">
          If you allow location access, your coordinates, speed, and heading are
          used on your device for map positioning, distance calculations, and
          Ride Mode. Simply opening those features does not cause Out Of Sight
          to store that location on its servers.
        </PrivacyRow>
        <PrivacyRow title="Live tracking on iPhone">
          Turning on Live tracking starts a location session that continues while
          you use other apps or lock your phone. Your device calculates the nearest
          tracked aircraft, distance, and ride state and shows them in a Live
          Activity. Your coordinates are not sent with aircraft-data requests.
          Tap Live again on Home to end this session and background location access.
          Ending Ride Mode does not stop Live tracking. If location or aircraft data expires, the activity shows that
          updates are paused or unavailable.
        </PrivacyRow>
        <PrivacyRow title="Takeoff alerts">
          Enabling alerts stores a random device ID, selected state, aircraft
          preferences, and either browser push details or a Firebase messaging
          token for the mobile app. Google Firebase and, on iPhone, Apple Push
          Notification service deliver mobile alerts. Alert subscriptions do not
          include your location or speed. Turning alerts off stops registration
          for notifications and deletes the server subscription.
        </PrivacyRow>
        <PrivacyRow title="Preferences">
          Local storage and first-party cookies remember choices such as state,
          time format, contrast, Ride Mode distances, and dismissed prompts on
          this device. Use “Reset preferences” in Display &amp; Time to clear them.
        </PrivacyRow>
        <PrivacyRow title="Routine requests">
          Hosting, database, push, and map providers receive the technical data
          normally sent with web requests, such as IP address, browser details,
          time, and requested resource. Map requests can reveal the area being
          viewed. Those providers apply their own privacy terms.
        </PrivacyRow>
        <PrivacyRow title="Retention and deletion">
          Any location reports submitted before reporting was discontinued
          remain subject to the seven-day retention and scheduled deletion
          policy. Turning off takeoff alerts deletes the associated push
          subscription from Out Of Sight. Preferences stored on the device can
          be removed with “Reset preferences” in Display &amp; Time. To request
          deletion of other data that may be associated with you, email the
          privacy contact above with enough detail to identify the relevant
          record, such as its approximate date and time. Data may be retained
          longer only when reasonably necessary for security, abuse prevention,
          or legal compliance.
        </PrivacyRow>
      </LegalSection>

      <LegalSection id="terms" title="Terms of use">
        <LegalClause title="Your agreement">
          By accessing or using Out Of Sight, you agree to these terms. If you do
          not agree, do not use the service.
        </LegalClause>
        <LegalClause title="Permitted use">
          The service is offered for lawful, personal, non-commercial,
          informational use. You may not use it to harm or endanger anyone,
          facilitate unlawful conduct, interfere with aircraft or communications,
          disrupt the service, bypass access controls, or redistribute third-party
          data in violation of its provider’s terms.
        </LegalClause>
        <LegalClause title="Availability and changes">
          Features, coverage, providers, aircraft records, and the service itself
          may change, pause, or end without notice. Access may be limited when
          needed to protect the service or comply with law or provider terms.
        </LegalClause>
        <LegalClause title="No warranties">
          The service and its information are provided “as is” and “as
          available.” To the fullest extent allowed by law, no warranty is made
          about accuracy, completeness, timeliness, availability, fitness for a
          particular purpose, or non-infringement.
        </LegalClause>
        <LegalClause title="Limits on liability">
          To the fullest extent allowed by law, the project operator,
          maintainers, and contributors are not liable for injury, property
          damage, citations, penalties, data loss, or other damages arising from
          access to, use of, inability to use, or reliance on the service.
        </LegalClause>
      </LegalSection>

      <LegalSection id="sources" title="Aircraft data & maps">
        <p>
          Aircraft observations come primarily from adsb.fi, with OpenSky
          Network used as a fallback. Aircraft registration and ownership
          details are derived primarily from the FAA Releasable Aircraft
          Database. Supplemental public agency records may help resolve
          ambiguous registrations. Out Of Sight has no access to private agency
          systems or official operational feeds.
        </p>
        <div className="ss-legal-providers">
          {PROVIDERS.map((provider) => (
            <a key={provider.name} href={provider.href} target="_blank" rel="noopener noreferrer">
              <span>
                <strong>{provider.name}</strong>
                <small>{provider.detail}</small>
              </span>
              <span aria-hidden>↗</span>
            </a>
          ))}
        </div>
        <p className="ss-legal-fine-print">
          Third-party services control their own availability, accuracy, terms,
          and privacy practices. Out Of Sight is an independent app. It is not
          affiliated with, endorsed by, or operated by the FAA or any federal,
          state, county, or local government agency, data provider, aircraft
          operator, or manufacturer.
        </p>
        <p className="ss-legal-fine-print">
          OpenSky attribution: Schäfer et al., <cite>Bringing Up OpenSky: A
          Large-scale ADS-B Sensor Network for Research</cite>, IPSN 2014.
        </p>
      </LegalSection>

    </SettingsPageShell>
  );
}

function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="ss-legal-section" aria-labelledby={`${id}-title`}>
      <header><h2 id={`${id}-title`}>{title}</h2></header>
      <div className="ss-legal-section__body">{children}</div>
    </section>
  );
}

function PrivacyRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ss-legal-privacy-row">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function LegalClause({ title, children }: { title: string; children: ReactNode }) {
  return <div className="ss-legal-clause"><h3>{title}</h3><p>{children}</p></div>;
}
