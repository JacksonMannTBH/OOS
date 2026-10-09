import { useEffect, useState } from "react";
import { AlertsSettings } from "@/components/AlertsSettings";
import { SettingsPageShell } from "@/components/SettingsPageShell";
import { SettingsCard } from "@/components/SettingsCard";
import { SelectedStateAircraftList } from "@/components/SelectedStateAircraftList";
import { getAircraftCatalogEntries, type AircraftCatalogEntry } from "./data";
export default function Alerts() {
  const [catalog, setCatalog] = useState<AircraftCatalogEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    void getAircraftCatalogEntries().then(value => { if (!cancelled) setCatalog(value); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [attempt]);
  return <SettingsPageShell eyebrow="Settings · Alerts" title="Notifications & state" description="Choose the state you track and whether this device receives confirmed takeoff notifications.">
    <AlertsSettings />
    {catalog ? <SelectedStateAircraftList catalog={catalog} /> : <SettingsCard title="Tracked aircraft"><p role="status">{error ? "Aircraft data is unavailable. Check your connection." : "Loading aircraft…"}</p>{error && <button onClick={() => setAttempt(value => value + 1)}>Try again</button>}</SettingsCard>}
  </SettingsPageShell>;
}
