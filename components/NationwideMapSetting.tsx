"use client";

import { useState } from "react";
import { useNationwideMapEnabled } from "@/lib/hooks/useNationwideMapEnabled";
import { writeNationwideMapEnabled } from "@/lib/nationwide-map-settings";
import { SettingsCard } from "./SettingsCard";
import { SS_TOKENS } from "@/lib/tokens";

export function NationwideMapSetting() {
  const enabled = useNationwideMapEnabled();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const change = async (checked: boolean) => {
    setSaving(true);
    setError(false);
    try { await writeNationwideMapEnabled(checked); }
    catch { setError(true); }
    finally { setSaving(false); }
  };
  return <SettingsCard title="Nationwide map">
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 52, cursor: saving ? "default" : "pointer" }}>
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 14, fontWeight: 800 }}>Show aircraft from all states</strong>
      </span>
      <input type="checkbox" role="switch" checked={enabled} disabled={saving} onChange={event => void change(event.target.checked)}
        aria-label="Show aircraft from all states" style={{ width: 22, height: 22, flexShrink: 0, accentColor: SS_TOKENS.alert, cursor: "inherit" }} />
    </label>
    {error && <p role="alert" style={{ margin: 0, color: SS_TOKENS.danger, fontSize: 13 }}>Could not save the map setting. Please try again.</p>}
  </SettingsCard>;
}
