import { AlertsSettings } from "@/components/AlertsSettings";
import { SettingsPageShell } from "@/components/SettingsPageShell";

export const metadata = {
  title: "Alerts",
  description: "Choose an alert state and manage takeoff notifications.",
};

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  return (
    <SettingsPageShell
      eyebrow="Settings · Alerts"
      title="Notifications & state"
      description="Choose the state you track and whether this device receives confirmed takeoff notifications."
    >
      <AlertsSettings />
    </SettingsPageShell>
  );
}
