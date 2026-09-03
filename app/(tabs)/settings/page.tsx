import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Settings",
  description: "Tune Out Of Sight for how you ride.",
};

export const dynamic = "force-static";

type SettingsLink = {
  href: string;
  title: string;
  body: string;
  icon: "bell" | "ride" | "display" | "aircraft" | "about" | "legal" | "store";
  accent: string;
};

const PRIMARY_LINKS: SettingsLink[] = [
  { href: "/settings/alerts", title: "Notifications & state", body: "Tracking area and takeoff alerts", icon: "bell", accent: "#f6c431" },
  { href: "/settings/ride", title: "Ride mode", body: "Wake behavior and distance bands", icon: "ride", accent: "#5ade87" },
  { href: "/settings/display", title: "Display & time", body: "Contrast and clock preferences", icon: "display", accent: "#8bd2ff" },
];

const MORE_LINKS: SettingsLink[] = [
  { href: "/aircraft", title: "Tracked Aircrafts", body: "Tracked fleet and operators", icon: "aircraft", accent: "#f6c431" },
  { href: "/about", title: "About", body: "Project background and mission", icon: "about", accent: "#8bd2ff" },
  { href: "/legal", title: "Legal & privacy", body: "Safety, privacy, and data use", icon: "legal", accent: "#b7b2a7" },
  { href: "/store", title: "Store", body: "Gear and project updates", icon: "store", accent: "#ff7a1a" },
];

export default function SettingsHub() {
  return (
    <main className="ss-settings-hub">
      <header className="ss-settings-hub__header">
        <h1>Settings</h1>
        <p>Make Out Of Sight work the way you ride.</p>
      </header>

      <SettingsGroup label="Preferences" links={PRIMARY_LINKS} featured />
      <SettingsGroup label="Out Of Sight" links={MORE_LINKS} />
    </main>
  );
}

function SettingsGroup({ label, links, featured = false }: { label: string; links: SettingsLink[]; featured?: boolean }) {
  const headingId = `settings-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section className="ss-settings-group" aria-labelledby={headingId}>
      <h2 id={headingId} className="ss-settings-group__label">{label}</h2>
      <nav aria-label={label} className="ss-settings-list">
        {links.map((link) => (
          <Link key={link.href} href={link.href} prefetch={false} className={`ss-settings-row${featured ? " ss-settings-row--featured" : ""}`}>
            <span className="ss-settings-row__icon" style={{ color: link.accent, background: `${link.accent}17` }}>
              <SettingsIcon name={link.icon} />
            </span>
            <span className="ss-settings-row__copy">
              <strong>{link.title}</strong>
              <span>{link.body}</span>
            </span>
            <span className="ss-settings-row__chevron" aria-hidden>›</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

function SettingsIcon({ name }: { name: SettingsLink["icon"] }) {
  const paths: Record<SettingsLink["icon"], ReactNode> = {
    bell: <path d="M7 17h10M9 17v-5a3 3 0 0 1 6 0v5M11 20h2" />,
    ride: <path d="m19 5-6.2 14-2.3-5.5L5 11.2 19 5Z" />,
    display: <path d="M5 6h14v10H5zM9 20h6M12 16v4" />,
    aircraft: <path d="m3 13 8-2V5l2-2 1 7 6-1 1 2-7 3-1 6-2 1v-6l-6 1Z" />,
    about: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    legal: <path d="M12 3 5 6v5c0 4.5 2.7 8 7 10 4.3-2 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4" />,
    store: <path d="M5 8h14l-1 12H6L5 8Zm3 0a4 4 0 0 1 8 0" />,
  };

  return <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
