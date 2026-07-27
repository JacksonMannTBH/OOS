import { AlertsSettings } from "@/components/AlertsSettings";
import { ResetPreferencesButton } from "@/components/ResetPreferencesButton";

export const metadata = {
  title: "Settings",
  description: "Tune Out Of Sight state alerts and device preferences.",
};

export const dynamic = "force-dynamic";

const SECTION_WRAP = {
  maxWidth: 460,
  margin: "16px auto 0",
  padding: "0 18px",
} as const;

const PAGE_WRAP = {
  minHeight: "calc(100dvh + 764px)",
} as const;

export default async function AlertsPage() {
  return (
    <div style={PAGE_WRAP}>
      <AlertsSettings />
      <div style={{ ...SECTION_WRAP, marginBottom: 80 }}>
        <ResetPreferencesButton />
      </div>
    </div>
  );
}
