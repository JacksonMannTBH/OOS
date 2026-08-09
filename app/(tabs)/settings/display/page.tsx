import { ContrastSetting } from "@/components/ContrastSetting";
import { ResetPreferencesButton } from "@/components/ResetPreferencesButton";
import { SettingsPageShell } from "@/components/SettingsPageShell";
import { TimeFormatSetting } from "@/components/TimeFormatSetting";
import { getContrastPref, getTimeFormatPref } from "@/lib/user-prefs";

export const metadata = {
  title: "Display Settings",
  description: "Choose time and contrast preferences for Out Of Sight.",
};

export const dynamic = "force-dynamic";

export default function DisplaySettingsPage() {
  const timeFormat = getTimeFormatPref();
  const contrast = getContrastPref();

  return (
    <SettingsPageShell
      eyebrow="Settings · Display"
      title="Display & time"
      description="Choose how timestamps and secondary information appear across Out Of Sight."
    >
      <TimeFormatSetting current={timeFormat} />
      <ContrastSetting current={contrast} />
      <ResetPreferencesButton />
    </SettingsPageShell>
  );
}
