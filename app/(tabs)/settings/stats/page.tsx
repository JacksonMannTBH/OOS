import { AllTimeRideStats } from "@/components/AllTimeRideStats";
import { SettingsPageShell } from "@/components/SettingsPageShell";

export const metadata = { title: "Stats", description: "Your all-time ride records." };

export default function StatsPage() {
  return <SettingsPageShell title="Stats" description="Your all-time ride records.">
    <AllTimeRideStats />
  </SettingsPageShell>;
}
