"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";
import { useRideLaunchPreflight } from "@/lib/hooks/useRideLaunchPreflight";

type Props = {
  variant?: "hero" | "compact" | "plain";
};

export function TakeOffButton({ variant = "hero" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runRideLaunchPreflight = useRideLaunchPreflight();
  const [busy, setBusy] = useState(false);
  const compact = variant === "compact";
  const plain = variant === "plain";

  const onTakeOff = async () => {
    setBusy(true);
    await runRideLaunchPreflight();
    const mock = searchParams.get("mock");
    router.push(mock ? `/ride?mock=${encodeURIComponent(mock)}` : "/ride");
  };

  return (
    <button
      type="button"
      onClick={onTakeOff}
      disabled={busy}
      aria-label="Start Ride"
      style={{
        boxSizing: "border-box",
        width: compact || plain ? "auto" : "min(100%, 460px)",
        minHeight: compact || plain ? 48 : 56,
        padding: compact ? "0 18px" : plain ? "0 6px" : "0 18px",
        borderRadius: compact || plain ? 0 : 18,
        border: plain
          ? 0
          : compact
          ? "1px solid rgba(246, 196, 49, 0.34)"
          : "1px solid #f6c431",
        background: plain ? "transparent" : busy ? "#1b1608" : "#f6c431",
        color: plain ? SS_TOKENS.alert : busy ? "#f6c431" : "#050505",
        boxShadow: plain
          ? "none"
          : compact
          ? "0 3px 10px rgba(0, 0, 0, 0.26)"
          : "0 16px 50px rgba(0, 0, 0, 0.28)",
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.72 : 1,
        fontFamily: "inherit",
        fontSize: compact || plain ? 16 : 18,
        fontWeight: compact || plain ? 800 : 900,
        letterSpacing: 0,
        display: "inline-flex",
        alignItems: "center",
        alignSelf: compact ? undefined : "center",
        justifyContent: "center",
        gap: compact ? 8 : 10,
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span>{busy ? "Starting Ride..." : "Start Ride"}</span>
    </button>
  );
}
