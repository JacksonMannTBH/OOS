import SettingsHub from "@/components/SettingsHub";

export const metadata = {
  title: "Settings",
  description: "Tune Out Of Sight for how you ride.",
};

export const dynamic = "force-static";

export default function SettingsPage() {
  return <SettingsHub />;
}
