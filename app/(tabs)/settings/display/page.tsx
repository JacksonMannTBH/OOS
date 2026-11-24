import { ResetPreferencesButton } from "@/components/ResetPreferencesButton";
import { DistanceColorSetting } from "@/components/DistanceColorSetting";
import { ColorModeSetting } from "@/components/ColorModeSetting";
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
      title="Ride mode & display"
    >
      <RideSettings />
      <ColorModeSetting />
      <DistanceColorSetting />
      <TimeFormatSetting current={timeFormat} />
      <ResetPreferencesButton />
    </SettingsPageShell>
  );
}
