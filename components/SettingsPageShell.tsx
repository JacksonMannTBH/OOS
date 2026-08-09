import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import type { ReactNode } from "react";

export function SettingsPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        boxSizing: "border-box",
        padding: "22px 20px 170px",
        maxWidth: 430,
        margin: "0 auto",
        display: "grid",
        alignContent: "start",
        gap: 18,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <Link
          href="/settings"
          prefetch={false}
          aria-label="Back to Settings"
          style={{
            width: "fit-content",
            minHeight: 44,
            margin: "-10px -10px 2px",
            padding: "0 10px",
            display: "inline-flex",
            alignItems: "center",
            color: SS_TOKENS.fg1,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          <span aria-hidden style={{ marginRight: 5 }}>
            ‹
          </span>
          Settings
        </Link>
        <span className="ss-eyebrow">{eyebrow}</span>
        <h1
          style={{
            margin: 0,
            color: SS_TOKENS.fg0,
            fontSize: 32,
            fontWeight: 850,
            lineHeight: 1.08,
            letterSpacing: 0,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: 0,
            color: SS_TOKENS.fg1,
            fontSize: 15,
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      </header>
      {children}
    </main>
  );
}
