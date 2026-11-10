"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { SS_TOKENS } from "@/lib/tokens";
import { SettingsPageShell } from "@/components/SettingsPageShell";

export function HelpContent({ source }: { source: string }) {
  const body = source.replace(/^\s*# [^\n]+\n+/, "");
  return (
    <SettingsPageShell title="Help" description="How to read each screen, manage tracking, and use OOS.">
      <article>
        <HelpMarkdown source={body} />
      </article>
      <HelpScrollTopButton />
    </SettingsPageShell>
  );
}

export function HelpMarkdown({ source }: { source: string }) {
  return (
    <div className="ss-help-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: "append",
              properties: { className: "ss-help-anchor", ariaLabel: "Permalink" },
              content: { type: "text", value: " #" },
            },
          ],
        ]}
        components={{
          h1: (props) => (
            <h1
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: "-.03em",
                color: SS_TOKENS.fg0,
                margin: "0 0 16px",
                lineHeight: 1.15,
              }}
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              style={{
                fontSize: 19,
                fontWeight: 850,
                color: SS_TOKENS.fg0,
                marginTop: 32,
                marginBottom: 12,
                lineHeight: 1.3,
              }}
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              style={{
                fontSize: 16,
                fontWeight: 750,
                color: SS_TOKENS.fg0,
                marginTop: 24,
                marginBottom: 10,
                lineHeight: 1.4,
              }}
              {...props}
            />
          ),
          p: (props) => (
            <p
              style={{
                fontSize: 14,
                color: SS_TOKENS.fg1,
                lineHeight: 1.6,
                margin: "0 0 16px",
              }}
              {...props}
            />
          ),
          ul: (props) => (
            <ul
              style={{
                paddingLeft: 20,
                margin: "0 0 18px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: SS_TOKENS.fg1,
                fontSize: 14,
                lineHeight: 1.6,
              }}
              {...props}
            />
          ),
          ol: (props) => (
            <ol
              style={{
                paddingLeft: 22,
                margin: "0 0 18px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: SS_TOKENS.fg1,
                fontSize: 14,
                lineHeight: 1.6,
              }}
              {...props}
            />
          ),
          li: (props) => <li {...props} />,
          a: ({ href, children, className, ...rest }) => {
            const isAnchor = className === "ss-help-anchor";
            return (
              <a
                href={href}
                className={className}
                style={
                  isAnchor
                    ? {
                        // fg2 not fg3 — anchor "#" link is body text on
                        // hover and needs WCAG AA contrast (4.5:1).
                        color: SS_TOKENS.fg2,
                        textDecoration: "none",
                        marginLeft: 8,
                        opacity: 0,
                        transition: "opacity 200ms",
                        fontSize: ".75em",
                      }
                    : {
                        color: SS_TOKENS.alert,
                        textDecoration: "underline",
                        textDecorationColor: `color-mix(in srgb, ${SS_TOKENS.alert} 34%, transparent)`,
                      }
                }
                {...rest}
              >
                {children}
              </a>
            );
          },
          code: ({ children, ...rest }) => (
            <code
              style={{
                fontFamily: "var(--font-mono)",
                background: SS_TOKENS.bg1,
                color: SS_TOKENS.fg0,
                fontSize: ".92em",
                padding: "2px 5px",
                borderRadius: 3,
              }}
              {...rest}
            >
              {children}
            </code>
          ),
          pre: ({ children, ...rest }) => (
            <pre
              style={{
                fontFamily: "var(--font-mono)",
                background: SS_TOKENS.bg1,
                color: SS_TOKENS.fg0,
                padding: 16,
                borderRadius: 8,
                overflowX: "auto",
                fontSize: 13,
                lineHeight: 1.55,
                margin: "0 0 18px",
                border: `.5px solid ${SS_TOKENS.hairline}`,
              }}
              {...rest}
            >
              {children}
            </pre>
          ),
          blockquote: (props) => (
            <blockquote
              style={{
                margin: "0 0 18px",
                paddingLeft: 14,
                borderLeft: `4px solid ${SS_TOKENS.fg3}`,
                color: SS_TOKENS.fg1,
                fontStyle: "italic",
                fontSize: 14,
                lineHeight: 1.6,
              }}
              {...props}
            />
          ),
          hr: () => (
            <hr
              style={{
                border: 0,
                borderTop: `.5px solid ${SS_TOKENS.hairline}`,
                margin: "32px 0",
              }}
            />
          ),
          strong: (props) => (
            <strong style={{ color: SS_TOKENS.fg0, fontWeight: 700 }} {...props} />
          ),
          em: (props) => (
            <em style={{ color: SS_TOKENS.fg1, fontStyle: "italic" }} {...props} />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
      {/* dangerouslySetInnerHTML bypasses React's HTML-entity encoding
          of children inside <style>. Without it the SSR pass emits
          encoded quotes inside CSS comments and a hydration mismatch
          fires on every help-page mount. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .ss-help-prose h2:hover .ss-help-anchor,
        .ss-help-prose h3:hover .ss-help-anchor,
        .ss-help-prose h2:focus-within .ss-help-anchor,
        .ss-help-prose h3:focus-within .ss-help-anchor {
          opacity: 1 !important;
        }
        .ss-help-prose h2 { scroll-margin-top: 72px; }
        .ss-help-prose h3 { scroll-margin-top: 72px; }
        @media (hover: none) {
          .ss-help-prose .ss-help-anchor {
            display: none;
          }
        }
      `,
        }}
      />
    </div>
  );
}

export function HelpScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className="ss-mono"
      style={{
        position: "fixed",
        left: "max(18px, env(safe-area-inset-left, 0px))",
        bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
        zIndex: 20,
        padding: "10px 14px",
        minHeight: 44,
        borderRadius: 999,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        boxShadow: "none",
        color: SS_TOKENS.fg1,
        fontSize: 11,
        letterSpacing: ".06em",
        cursor: "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      ↑ Top
    </button>
  );
}
