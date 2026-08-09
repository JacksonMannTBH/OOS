import Link from "next/link";
import type { ReactNode } from "react";
import { SS_TOKENS } from "@/lib/tokens";

export type DetailBreadcrumb = {
  label: string;
  href?: string;
};

export type DetailMetric = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
};

export type DetailNavLink = {
  href: string;
  label: string;
};

export function DetailBreadcrumbs({ items }: { items: DetailBreadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexWrap: "wrap",
          color: SS_TOKENS.fg2,
          fontSize: 12,
        }}
      >
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li
              key={`${item.href ?? "current"}-${item.label}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              {index > 0 && <span aria-hidden>/</span>}
              {item.href && !current ? (
                <Link
                  href={item.href}
                  prefetch={false}
                  style={{
                    minHeight: 44,
                    display: "inline-flex",
                    alignItems: "center",
                    color: SS_TOKENS.fg1,
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" style={{ color: SS_TOKENS.fg0 }}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DetailSectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <header style={{ display: "grid", gap: 5 }}>
      {eyebrow && <span className="ss-eyebrow">{eyebrow}</span>}
      <h2
        id={id}
        style={{
          margin: 0,
          color: SS_TOKENS.fg0,
          fontSize: 20,
          lineHeight: 1.15,
          letterSpacing: 0,
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          style={{
            margin: 0,
            color: SS_TOKENS.fg1,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
    </header>
  );
}

export function DetailMetricList({ items }: { items: DetailMetric[] }) {
  return (
    <dl
      style={{
        margin: 0,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(138px, 1fr))",
        columnGap: 18,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            minWidth: 0,
            padding: "13px 0",
            borderTop: `1px solid ${SS_TOKENS.hairline}`,
          }}
        >
          <dt
            className="ss-eyebrow"
            style={{ marginBottom: 5, color: SS_TOKENS.fg2 }}
          >
            {item.label}
          </dt>
          <dd
            style={{
              margin: 0,
              color: SS_TOKENS.fg0,
              fontSize: 16,
              fontWeight: 750,
              lineHeight: 1.25,
              overflowWrap: "anywhere",
            }}
          >
            {item.value}
          </dd>
          {item.detail && (
            <div
              style={{
                marginTop: 4,
                color: SS_TOKENS.fg1,
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              {item.detail}
            </div>
          )}
        </div>
      ))}
    </dl>
  );
}

export function DetailActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      style={{
        boxSizing: "border-box",
        minHeight: 48,
        minWidth: 172,
        flex: "1 1 172px",
        padding: "0 16px",
        borderRadius: 16,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        background: primary ? SS_TOKENS.alert : SS_TOKENS.surface,
        border: primary
          ? `1px solid ${SS_TOKENS.alert}`
          : `1px solid ${SS_TOKENS.hairline2}`,
        color: primary ? "#050505" : SS_TOKENS.fg0,
        boxShadow: primary ? SS_TOKENS.shadowSm : "none",
        fontSize: 14,
        fontWeight: 850,
        textDecoration: "none",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </Link>
  );
}

export function DetailTechnicalDetails({
  summary = "Show technical details",
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details
      style={{
        background: SS_TOKENS.surface,
        border: `1px solid ${SS_TOKENS.hairline}`,
        borderRadius: 16,
        padding: "0 16px",
      }}
    >
      <summary
        style={{
          minHeight: 48,
          display: "flex",
          alignItems: "center",
          color: SS_TOKENS.fg0,
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
          touchAction: "manipulation",
        }}
      >
        <span style={{ flex: 1 }}>{summary}</span>
        <span aria-hidden style={{ color: SS_TOKENS.fg2, marginLeft: 12 }}>
          ⌄
        </span>
      </summary>
      <div style={{ paddingBottom: 4 }}>{children}</div>
    </details>
  );
}

export function DetailContextNav({
  links,
  label = "Related pages",
}: {
  links: DetailNavLink[];
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      style={{
        marginTop: 8,
        paddingTop: 16,
        borderTop: `1px solid ${SS_TOKENS.hairline}`,
        display: "flex",
        justifyContent: "center",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      {links.map((link) => (
        <Link
          key={`${link.href}-${link.label}`}
          href={link.href}
          prefetch={false}
          style={{
            minHeight: 44,
            padding: "0 12px",
            display: "inline-flex",
            alignItems: "center",
            color: SS_TOKENS.fg1,
            fontSize: 12,
            fontWeight: 750,
            textDecoration: "none",
          }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function DetailMapLoading({ height = 340 }: { height?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        height,
        borderRadius: 16,
        background: SS_TOKENS.surface,
        border: `1px solid ${SS_TOKENS.hairline}`,
        display: "grid",
        placeItems: "center",
        color: SS_TOKENS.fg1,
        fontSize: 13,
      }}
    >
      Loading flight map…
    </div>
  );
}
