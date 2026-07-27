import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "Settings",
  description: "Tune Out Of Sight for how you ride.",
};

export const dynamic = "force-static";

const HUB_LINKS = [
  {
    href: "/settings/alerts",
    eyebrow: "Alerts",
    title: "Alerts, state, wake",
    body: "Arm notifications, choose a state, tune ride ranges, and control device wake behavior.",
  },
  {
    href: "/about",
    eyebrow: "Reference",
    title: "About and aircraft",
    body: "Review aircraft, operators, roles, and project notes.",
  },
  {
    href: "/legal",
    eyebrow: "Reference",
    title: "Legal",
    body: "Read the safety, privacy, and data-source notes.",
  },
  {
    href: "/store",
    eyebrow: "Store",
    title: "Out Of Sight store",
    body: "Gear and updates live here as they become available.",
  },
] as const;

export default function SettingsHub() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "22px 20px 170px",
        maxWidth: 430,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <Link
          href="/dash"
          style={{
            width: "fit-content",
            minHeight: 40,
            padding: "0 14px",
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 14,
            border: `1px solid ${SS_TOKENS.hairline}`,
            background: "rgba(255, 255, 255, 0.04)",
            color: SS_TOKENS.fg1,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          Home
        </Link>
        <span className="ss-eyebrow">Settings</span>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 850,
            letterSpacing: 0,
            margin: 0,
            color: SS_TOKENS.fg0,
          }}
        >
          Tune into Out Of Sight
        </h1>
        <p
          style={{
            fontSize: 15,
            color: SS_TOKENS.fg1,
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          Display preferences stay on this device. Your selected alert state
          syncs to this device&rsquo;s notification subscription.
        </p>
      </header>

      <nav
        aria-label="Settings sections"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {HUB_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            style={{
              display: "block",
              padding: "18px 20px",
              borderRadius: 16,
              border: `1px solid ${SS_TOKENS.hairline}`,
              background: SS_TOKENS.surface,
              boxShadow: "none",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              textDecoration: "none",
              minHeight: 44,
            }}
          >
            <div
              className="ss-eyebrow"
              style={{ marginBottom: 7, color: SS_TOKENS.alert }}
            >
              {link.eyebrow}
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: SS_TOKENS.fg0,
                marginBottom: 5,
              }}
            >
              {link.title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: SS_TOKENS.fg1,
                lineHeight: 1.5,
              }}
            >
              {link.body}
            </div>
          </Link>
        ))}
      </nav>
    </main>
  );
}
