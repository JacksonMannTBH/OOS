import SettingsHub from "@/components/SettingsHub";

export const metadata = { title: "Settings" };

export default function Settings() {
  return <SettingsHub includeStore={false} />;
}
