import { ResetPreferencesButton } from "@/components/ResetPreferencesButton";
import { RideSettings } from "@/components/RideSettings";
import { SettingsPageShell } from "@/components/SettingsPageShell";
import { TimeFormatSetting } from "@/components/TimeFormatSetting";
import { getTimeFormatPref } from "@/lib/user-prefs";

export const metadata = {
  title: "Ride Mode & Display Settings",
  description:
    "Tune Ride mode behavior, distance bands, and time preferences.",
};

export const dynamic = "force-dynamic";

export default function DisplaySettingsPage() {
  const timeFormat = getTimeFormatPref();

  return (
    <SettingsPageShell
      eyebrow="Settings · Ride mode & display"
      title="Ride mode & display"
      description="Control Ride mode behavior, distance bands, and time preferences."
    >
      <RideSettings />
      <TimeFormatSetting current={timeFormat} />
      <ResetPreferencesButton />
    </SettingsPageShell>
  );
}
