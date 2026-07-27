import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { Logo } from "@/components/brand/Logo";

export const metadata = {
  title: "Lost your signal",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: "32px 24px 80px",
        textAlign: "center",
        color: SS_TOKENS.fg1,
      }}
    >
      <div
        aria-hidden
        className="ss-spin"
        style={{ color: SS_TOKENS.fg3 }}
      >
        <Logo size={96} mono />
      </div>

      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span
          className="ss-mono"
          style={{
            fontSize: 10.5,
            color: SS_TOKENS.fg2,
            letterSpacing: ".14em",
            textTransform: "uppercase",
          }}
        >
          404 · Not found
        </span>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: "-.03em",
            color: SS_TOKENS.fg0,
            margin: 0,
            lineHeight: 1.05,
          }}
        >
          Lost your signal.
        </h1>
        <p
          style={{
            fontSize: 15,
            color: SS_TOKENS.fg1,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Channel 19 still open.
        </p>
      </header>

      <nav
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <NavBtn href="/">Home</NavBtn>
        <NavBtn href="/map">Map</NavBtn>
        <NavBtn href="/dash#recent-events">Recent events</NavBtn>
      </nav>
    </main>
  );
}

function NavBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="ss-mono"
      style={{
        padding: "10px 16px",
        borderRadius: 999,
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        background: SS_TOKENS.bg1,
        color: SS_TOKENS.fg0,
        fontSize: 12,
        letterSpacing: ".06em",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
