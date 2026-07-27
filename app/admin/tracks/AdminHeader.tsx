import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { logoutAction } from "../actions";

type Active = "registry" | "flights" | "health" | "spots";

export function AdminHeader({
  active,
  subtitle,
}: {
  active: Active;
  subtitle?: string;
}) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 18,
        gap: 12,
      }}
    >
      <h1
        className="ss-mono"
        style={{
          fontSize: 16,
          color: SS_TOKENS.fg0,
          letterSpacing: ".06em",
          margin: 0,
        }}
      >
        OUT OF SIGHT ADMIN
        {subtitle && (
          <span style={{ color: SS_TOKENS.fg2, fontWeight: 400 }}>
            {" · "}
            {subtitle}
          </span>
        )}
      </h1>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <NavLink href="/admin" active={active === "registry"}>
          REGISTRY
        </NavLink>
        <NavLink href="/admin/tracks" active={active === "flights"}>
          FLIGHTS
        </NavLink>
        <NavLink href="/admin/fleet-health" active={active === "health"}>
          HEALTH
        </NavLink>
        <NavLink href="/admin/spots" active={active === "spots"}>
          SPOTS
        </NavLink>
        <form action={logoutAction}>
          <button
            type="submit"
            className="ss-mono"
            style={{
              fontSize: 11,
              color: SS_TOKENS.fg2,
              letterSpacing: ".08em",
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
            }}
          >
            LOG OUT
          </button>
        </form>
        <Link
          href="/help"
          aria-label="Help and documentation"
          title="Help & docs"
          className="ss-mono"
          style={{
            fontSize: 11,
            color: SS_TOKENS.fg2,
            letterSpacing: ".08em",
            textDecoration: "none",
          }}
        >
          ?
        </Link>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="ss-mono"
      style={{
        fontSize: 11,
        color: active ? SS_TOKENS.alert : SS_TOKENS.fg1,
        letterSpacing: ".08em",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
