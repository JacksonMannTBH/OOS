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
  icon: "bell" | "ride" | "aircraft" | "about" | "help" | "legal" | "store";
  accent: string;
};

const PRIMARY_LINKS: SettingsLink[] = [
  { href: "/settings/alerts", title: "Notifications & state", body: "Tracking area and takeoff alerts", icon: "bell", accent: "#f6c431" },
  { href: "/settings/display", title: "Ride mode & display", body: "Wake behavior, distance bands, and time", icon: "ride", accent: "#f6c431" },
];

const MORE_LINKS: SettingsLink[] = [
  { href: "/help", title: "Help & support", body: "Using the app and getting in touch", icon: "help", accent: "#f6c431" },
  { href: "/aircraft", title: "Tracked Aircrafts", body: "Tracked fleet and operators", icon: "aircraft", accent: "#f6c431" },
  { href: "/about", title: "About", body: "Project background and mission", icon: "about", accent: "#f6c431" },
  { href: "/legal", title: "Legal & privacy", body: "Safety, privacy, and data use", icon: "legal", accent: "#f6c431" },
  { href: "/store", title: "Store", body: "Gear and project updates", icon: "store", accent: "#f6c431" },
];

export default function SettingsHub() {
  return (
    <main className="ss-settings-hub">
      <header className="ss-settings-hub__header">
        <h1>Settings</h1>
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
            <span className="ss-settings-row__icon" style={{ color: link.accent }}>
              <SettingsIcon name={link.icon} />
            </span>
            <span className="ss-settings-row__copy">
              <strong>{link.title}</strong>
              <span>{link.body}</span>
            </span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

function SettingsIcon({ name }: { name: SettingsLink["icon"] }) {
  const paths: Record<SettingsLink["icon"], ReactNode> = {
    help: <path fillRule="evenodd" d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M6.496 6.033a1.504 1.504 0 0 1 3.008 0c0 .567-.262.822-.864 1.252-.661.472-1.64 1.17-1.64 2.465a.75.75 0 0 0 1.5 0c0-.488.314-.797 1.012-1.295.713-.51 1.492-1.146 1.492-2.422a3.004 3.004 0 0 0-6.008 0 .75.75 0 0 0 1.5 0M8 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2" />,
    bell: <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2m.995-14.901a1 1 0 1 0-1.99 0A5 5 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901" />,
    ride: <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6" />,
    aircraft: <path d="M6.428 1.151C6.708.591 7.213 0 8 0s1.292.592 1.572 1.151C9.861 1.73 10 2.431 10 3v3.691l5.17 2.585a1.5 1.5 0 0 1 .83 1.342V12a.5.5 0 0 1-.582.493l-5.507-.918-.375 2.253 1.318 1.318A.5.5 0 0 1 10.5 16h-5a.5.5 0 0 1-.354-.854l1.319-1.318-.376-2.253-5.507.918A.5.5 0 0 1 0 12v-1.382a1.5 1.5 0 0 1 .83-1.342L6 6.691V3c0-.568.14-1.271.428-1.849" />,
    about: <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm8.93 4.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2" />,
    legal: <path fillRule="evenodd" d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0-1.044 1.262c-.596 4.477.787 7.795 2.465 9.99a11.8 11.8 0 0 0 2.517 2.453c.386.273.744.482 1.048.625.28.132.581.24.829.24s.548-.108.829-.24a7 7 0 0 0 1.048-.625 11.8 11.8 0 0 0 2.517-2.453c1.678-2.195 3.061-5.513 2.465-9.99a1.54 1.54 0 0 0-1.044-1.263 63 63 0 0 0-2.887-.87C9.843.266 8.69 0 8 0m2.146 5.146a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793z" />,
    store: <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4z" />,
  };

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      fill="currentColor"
      stroke="none"
    >
      {paths[name]}
    </svg>
  );
}
