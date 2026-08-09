import { RideSettings } from "@/components/RideSettings";
import { SettingsPageShell } from "@/components/SettingsPageShell";

export const metadata = {
  title: "Ride Mode Settings",
  description: "Tune wake behavior and Ride mode distance bands.",
};

export const dynamic = "force-static";

export default function RideSettingsPage() {
  return (
    <SettingsPageShell
      eyebrow="Settings · Ride mode"
      title="Ride behavior"
      description="Control screen wake behavior and choose the distance bands used by Ride mode."
    >
      <RideSettings />
    </SettingsPageShell>
  );
}
