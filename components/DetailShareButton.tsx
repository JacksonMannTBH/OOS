"use client";

import { useEffect, useRef, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";

type ShareState = "idle" | "shared" | "copied" | "error";

export function DetailShareButton({
  path,
  label = "Share flight",
}: {
  path: string;
  label?: string;
}) {
  const [state, setState] = useState<ShareState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const resetLater = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 2200);
  };

  const onShare = async () => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(normalizedPath, window.location.origin).toString();
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "Out Of Sight flight", url });
          setState("shared");
          resetLater();
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
      resetLater();
    } catch {
      setState("error");
      resetLater();
    }
  };

  const stateLabel =
    state === "shared"
      ? "Shared"
      : state === "copied"
        ? "Link copied"
        : state === "error"
          ? "Share unavailable"
          : label;

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label={label}
      style={{
        boxSizing: "border-box",
        minHeight: 48,
        minWidth: 150,
        flex: "1 1 150px",
        padding: "0 16px",
        borderRadius: 16,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: state === "error" ? SS_TOKENS.warnDim : SS_TOKENS.surface,
        border: `1px solid ${state === "error" ? SS_TOKENS.warn : SS_TOKENS.hairline2}`,
        color:
          state === "shared" || state === "copied"
            ? SS_TOKENS.clear
            : state === "error"
              ? SS_TOKENS.warn
              : SS_TOKENS.fg0,
        fontSize: 14,
        fontWeight: 800,
        cursor: "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <ShareIcon />
      <span role={state === "error" ? "alert" : "status"}>{stateLabel}</span>
    </button>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
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
