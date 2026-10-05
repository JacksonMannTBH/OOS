import { SpeedWarning } from "@/components/SpeedWarning";
import { ScreenAwake } from "@/components/ScreenAwake";
import { AppBadge } from "@/components/AppBadge";
import { SettingsHomeButton } from "@/components/SettingsHomeButton";
import { getSpeedWarningEnabled } from "@/lib/flags";
import { Suspense } from "react";

async function ConfiguredSpeedWarning() {
  const enabled = await getSpeedWarningEnabled();
  return <SpeedWarning enabled={enabled} />;
}

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div id="main-content">{children}</div>
      <SettingsHomeButton />
      <ScreenAwake />
      <AppBadge />
      <Suspense fallback={null}>
        <ConfiguredSpeedWarning />
      </Suspense>
    </>
  );
}
