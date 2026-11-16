import { AllTimeRideStats } from "@/components/AllTimeRideStats";
import { SettingsPageShell } from "@/components/SettingsPageShell";
import { ProStatsBoundary } from "@/components/ProAccess";

export const metadata = { title: "Stats", description: "Your all-time ride records." };

export default function StatsPage() {
  return <ProStatsBoundary><SettingsPageShell title="Stats">
    <AllTimeRideStats />
  </SettingsPageShell></ProStatsBoundary>;
}
