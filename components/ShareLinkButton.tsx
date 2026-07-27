"use client";

import { useEffect, useRef, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";

export function ShareLinkButton({
  path,
  label = "Copy link",
  size = "md",
}: {
  path: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const onClick = async () => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(normalizedPath, window.location.origin).toString();
    try {
      // Prefer native share sheet on mobile; fall back to clipboard.
      const navAny = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
      };
      if (typeof navAny.share === "function") {
        try {
          await navAny.share({ url });
          return; // share sheet handles its own UI
        } catch {
          // user cancelled, or share unsupported — try clipboard
        }
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — silently no-op */
    }
  };

  const isSm = size === "sm";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Copy share link${path ? `: ${path}` : ""}`}
      className="ss-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: isSm ? "5px 9px" : "7px 12px",
        borderRadius: 999,
        background: copied ? SS_TOKENS.clearDim : SS_TOKENS.bg2,
        border: `.5px solid ${copied ? `color-mix(in srgb, ${SS_TOKENS.clear} 34%, transparent)` : SS_TOKENS.hairline2}`,
        color: copied ? SS_TOKENS.clear : SS_TOKENS.fg1,
        fontSize: isSm ? 10 : 11,
        letterSpacing: ".04em",
        cursor: "pointer",
        whiteSpace: "nowrap",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <ShareIcon size={isSm ? 12 : 14} />
      {copied ? "Copied" : label}
    </button>
  );
}

function ShareIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
