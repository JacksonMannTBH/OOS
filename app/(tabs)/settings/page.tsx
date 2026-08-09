import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "Settings",
  description: "Tune Out Of Sight for how you ride.",
};

export const dynamic = "force-static";

const PRIMARY_LINKS = [
  {
    href: "/settings/alerts",
    title: "Notifications & State",
    body: "Choose the state you track and arm takeoff notifications.",
  },
  {
    href: "/settings/ride",
    title: "RIDE MODE SETTINGS",
    body: "Set wake mode and Watch, Warning, and Stop distances.",
  },
  {
    href: "/settings/display",
    title: "Display & Time",
    body: "Choose contrast and 12- or 24-hour time.",
  },
] as const;

const MORE_LINKS = [
  {
    href: "/aircraft",
    title: "Aircraft",
    body: "Tracked fleet and operators",
  },
  {
    href: "/about",
    title: "About",
    body: "Project background and mission",
  },
  {
    href: "/legal",
    title: "Legal",
    body: "Terms, privacy, safety, and data use",
  },
  {
    href: "/store",
    title: "Store",
    body: "Gear and project updates",
  },
] as const;

export default function SettingsHub() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        boxSizing: "border-box",
        padding: "22px 20px 170px",
        maxWidth: 430,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          marginBottom: 2,
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 850,
            lineHeight: 1.08,
            letterSpacing: 0,
            margin: 0,
            color: SS_TOKENS.fg0,
          }}
        >
          OOS Settings
        </h1>
      </header>

      <section aria-labelledby="preferences-heading">
        <h2
          id="preferences-heading"
          className="ss-eyebrow"
          style={{ margin: "0 0 10px", color: SS_TOKENS.fg2 }}
        >
          Preferences
        </h2>
        <nav
          aria-label="Settings pages"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              style={{
                minHeight: 96,
                boxSizing: "border-box",
                padding: "17px 18px",
                borderRadius: 16,
                border: `1px solid ${SS_TOKENS.hairline}`,
                background: SS_TOKENS.surface,
                display: "flex",
                alignItems: "center",
                gap: 14,
                textDecoration: "none",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
              }}
              >
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong
                  style={{
                    display: "block",
                    marginBottom: 5,
                    color: SS_TOKENS.alert,
                    fontSize: 18,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    textTransform: "uppercase",
                  }}
                >
                  {link.title}
                </strong>
                <span
                  style={{
                    display: "block",
                    color: SS_TOKENS.fg0,
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  {link.body}
                </span>
              </span>
              <span
                aria-hidden
                style={{ color: SS_TOKENS.fg2, fontSize: 28, lineHeight: 1 }}
              >
                ›
              </span>
            </Link>
          ))}
        </nav>
      </section>

      <section aria-labelledby="more-heading">
        <h2
          id="more-heading"
          className="ss-eyebrow"
          style={{ margin: "0 0 10px", color: SS_TOKENS.fg2 }}
        >
          More
        </h2>
        <nav
          aria-label="More pages"
          style={{
            overflow: "hidden",
            borderRadius: 16,
            border: `1px solid ${SS_TOKENS.hairline}`,
            background: SS_TOKENS.surface,
          }}
        >
          {MORE_LINKS.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              style={{
                minHeight: 64,
                boxSizing: "border-box",
                padding: "10px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderBottom:
                  index === MORE_LINKS.length - 1
                    ? 0
                    : `1px solid ${SS_TOKENS.hairline}`,
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong
                  style={{
                    display: "block",
                    color: SS_TOKENS.fg0,
                    fontSize: 15,
                    fontWeight: 800,
                    lineHeight: 1.2,
                  }}
                >
                  {link.title}
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
                  {link.body}
                </span>
              </span>
              <span
                aria-hidden
                style={{ color: SS_TOKENS.fg2, fontSize: 24, lineHeight: 1 }}
              >
                ›
              </span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
