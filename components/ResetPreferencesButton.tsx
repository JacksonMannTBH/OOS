"use client";

// Wipes rider-side display, state, and install-prompt preferences.
// Server cookie clear runs through the imported server action; localStorage
// is cleared inline so a server failure does not leave the rider half-reset.

import { useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import { resetPreferenceCookiesAction } from "@/app/(tabs)/settings/alerts/actions";

const LOCAL_STORAGE_KEYS = [
  "ss_wake_lock",
  "ss_ride_status_thresholds",
  "ss_flight_paths_visible",
  "ss_install_dismissed",
  "ss_post_install_dismissed",
  "ss_first_standalone_visit",
  "ss_distance_rings_visible",
  "oos_state_code",
  "oos_distance_rings_visible",
  "oos_aircraft_alert_device_id",
] as const;

function clearLocalStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // best-effort
    }
  }
}

export function ResetPreferencesButton() {
  const [busy, setBusy] = useState(false);

  return (
    <section
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <div
          className="ss-mono"
          style={{
            fontSize: 9.5,
            color: SS_TOKENS.fg2,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Reset
        </div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: SS_TOKENS.fg0,
            margin: 0,
            letterSpacing: "-.01em",
          }}
        >
          Restore defaults
        </h2>
        <p
          style={{
            fontSize: 13,
            color: SS_TOKENS.fg1,
            lineHeight: 1.5,
            marginTop: 6,
            marginBottom: 0,
          }}
        >
          Clears every preference on this device — display, alert UI, and state.
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (typeof window === "undefined") return;
          if (!window.confirm("Reset all preferences. Continue?")) return;
          setBusy(true);
          clearLocalStorage();
          try {
            await resetPreferenceCookiesAction();
          } catch {
            // server action failed â€” localStorage is already cleared, the
            // cookie clear can be retried on next page load
          }
          window.location.reload();
        }}
        style={{
          padding: "12px 16px",
          minHeight: 44,
          borderRadius: 12,
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          background: SS_TOKENS.bg2,
          color: SS_TOKENS.fg0,
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {busy ? "Resettingâ€¦" : "Reset preferences"}
      </button>
    </section>
  );
}
