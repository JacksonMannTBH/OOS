import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { openPro } from "@/lib/pro-access";
import { usePro } from "@/lib/hooks/usePro";
import { EliteSettings } from "@/components/EliteSettings";
import { SettingsPageShell } from "@/components/SettingsPageShell";

export const metadata = { title: "Elite Settings" };
export default function Elite() {
  const plan = usePro();
  const router = useRouter();
  useEffect(() => {
    if (plan.ready && !plan.elite) { router.replace("/settings"); queueMicrotask(() => openPro("elite")); }
  }, [plan.ready, plan.elite, router]);
  if (!plan.elite) return null;
  return <SettingsPageShell title="Elite Settings"><EliteSettings /></SettingsPageShell>;
}
