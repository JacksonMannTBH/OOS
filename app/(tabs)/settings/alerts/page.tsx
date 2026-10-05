import { AlertsSettings } from "@/components/AlertsSettings";
import { SettingsPageShell } from "@/components/SettingsPageShell";
import { SettingsCard } from "@/components/SettingsCard";
import { SelectedStateAircraftList } from "@/components/SelectedStateAircraftList";
import { getAircraftCatalogEntries } from "@/lib/aircraft-data";
import { Suspense } from "react";

export const metadata = {
  title: "Alerts",
  description: "Choose an alert state and manage takeoff notifications.",
};

export const dynamic = "force-dynamic";

async function StateAircraftCatalog() {
  const catalog = await getAircraftCatalogEntries();
  return <SelectedStateAircraftList catalog={catalog} />;
}

export default function AlertsPage() {
  return (
    <SettingsPageShell
      eyebrow="Settings · Alerts"
      title="Notifications & state"
      description="Choose the state you track and whether this device receives confirmed takeoff notifications."
    >
      <AlertsSettings />
      <Suspense fallback={<SettingsCard title="Tracked aircraft"><p role="status">Loading aircraft…</p></SettingsCard>}>
        <StateAircraftCatalog />
      </Suspense>
    </SettingsPageShell>
  );
}
