import { SettingsPageShell } from "@/components/SettingsPageShell";
import type { ReactNode } from "react";

export const metadata = {
  title: "Legal & Privacy",
  description: "How Out Of Sight handles safety, privacy, and third-party data.",
};

export const dynamic = "force-static";

const PROVIDERS = [
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
        <PrivacyRow title="Live location">
          If you allow location access, your coordinates, speed, and heading are
          used in your browser for map positioning, distance calculations, and
          Ride Mode. Simply opening those features does not cause Out Of Sight
          to store that location on its servers.
        </PrivacyRow>
        <PrivacyRow title="Spot reports">
          Tapping the spot-report control sends the reported coordinates,
          timestamp, and nearby-aircraft details to Out Of Sight. Nothing is
          submitted until you deliberately use that control. Reports are kept
          for up to seven days and then scheduled for deletion.
        </PrivacyRow>
        <PrivacyRow title="Takeoff alerts">
          Enabling alerts stores a random device ID, selected state, browser push
          endpoint, delivery keys, and browser identification needed to send the
          alert while alerts remain enabled. It does not include your location
          or speed. Turning alerts off unsubscribes the browser and deletes the
          server subscription.
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
          Network used as a fallback. Fleet details are assembled from public
          registry, agency, county, and fleet records. Out Of Sight has no access
          to private agency systems or official operational feeds.
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
          and privacy practices. Out Of Sight is not affiliated with or endorsed
          by any data provider, government agency, aircraft operator, or
          manufacturer.
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
