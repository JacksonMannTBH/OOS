"use client";

import { useState, type CSSProperties } from "react";
import {
  APP_STATES,
  stateCodeForId,
  setSelectedStateCode,
  type StateCode,
} from "@/lib/app-states";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { SS_TOKENS } from "@/lib/tokens";
import { useCaliforniaRegion } from "@/lib/hooks/useCaliforniaRegion";
import { setSelectedCaliforniaRegion, type CaliforniaRegion } from "@/lib/california-regions";

export function StateSelector({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const current = stateCodeForId(useSelectedStateId());
  const region = useCaliforniaRegion();

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%", minWidth: 0 }}>
      <select
        className={className}
        value={current}
        disabled={saving}
        onChange={(event) => {
          setSaving(true);
          setError(false);
          void setSelectedStateCode(event.target.value as StateCode)
            .catch(() => setError(true)).finally(() => setSaving(false));
        }}
        aria-label="State"
        style={{
          minHeight: 42,
          borderRadius: 10,
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          background: SS_TOKENS.bg1,
          color: SS_TOKENS.fg0,
          padding: "0 12px",
          font: "inherit",
          fontWeight: 700,
          ...style,
          minWidth: 0,
          flex: "1 1 auto",
        }}
      >
        {APP_STATES.map((state) => (
          <option key={state.code} value={state.code}>
            {state.label}
          </option>
        ))}
      </select>
      {current === "CA" && (
        <select
          aria-label="California region"
          value={region}
          disabled={saving}
          onChange={(event) => {
            setSaving(true);
            setError(false);
            void setSelectedCaliforniaRegion(event.target.value as CaliforniaRegion)
              .catch(() => setError(true)).finally(() => setSaving(false));
          }}
          style={{
            minHeight: 42, borderRadius: 10,
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            background: SS_TOKENS.bg1, color: SS_TOKENS.fg0,
            padding: "0 10px", font: "inherit", fontWeight: 700,
            ...style, width: "auto", minWidth: 0, flex: "0 0 auto",
          }}
        >
          <option value="north">North</option>
          <option value="south">South</option>
        </select>
      )}
      {error && <span role="alert">Could not save the selection. Try again.</span>}
    </span>
  );
}
