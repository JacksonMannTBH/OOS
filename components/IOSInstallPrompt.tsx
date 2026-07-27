"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";

const STORAGE_KEY = "ss_install_dismissed";
const DISMISS_DAYS = 30;
const TABBAR_HEIGHT = 66;

function isTabbedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return /^\/(map|dash|forecast|activity|about|legal|plane|settings)(\/|$)/.test(
    pathname,
  );
}

type Standalone = Navigator & { standalone?: boolean };

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOS =
    ua.includes("Macintosh") &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return Boolean((navigator as Standalone).standalone);
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function IOSInstallPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOSSafari()) return;
    if (isStandalone()) return;
    if (!isDismissed()) setVisible(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--ss-install-prompt-h",
      visible ? "80px" : "0px",
    );
    return () => {
      document.documentElement.style.setProperty("--ss-install-prompt-h", "0px");
    };
  }, [visible]);

  if (!visible) return null;

  const onTabs = isTabbedPath(pathname);
  const bottomOffset = onTabs ? TABBAR_HEIGHT : 0;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: bottomOffset,
        zIndex: 40,
        pointerEvents: "none",
        padding: "8px 4px 8px 14px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        background: SS_TOKENS.bg1,
        borderTop: `.5px solid ${SS_TOKENS.hairline}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45, color: SS_TOKENS.fg0 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2 }}>
          Add Out Of Sight to Home Screen
        </div>
        <div style={{ fontSize: 11.5, color: SS_TOKENS.fg1, lineHeight: 1.45 }}>
          Tap <ShareIcon /> then{" "}
          <span style={{ color: SS_TOKENS.alert }}>Add to Home Screen</span>
          for the app-style launch icon.
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        style={{
          width: 44,
          height: 44,
          background: "transparent",
          border: 0,
          color: SS_TOKENS.fg2,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          padding: 0,
          pointerEvents: "auto",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <XIcon />
        </span>
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ verticalAlign: "-2px", margin: "0 2px" }}
      aria-hidden
    >
      <path d="M12 3 v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14a2 2 0 0 0 2-2v-6" />
      <path d="M3 13v6a2 2 0 0 0 2 2" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
