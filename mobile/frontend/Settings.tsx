import { useState } from "react";
import SettingsHub from "@/components/SettingsHub";
import { openPro, setProTestingPlan } from "@/lib/pro-access";
import { usePro } from "@/lib/hooks/usePro";
export const metadata = { title: "Settings" };
export default function Settings() {
  const plan = usePro();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const previewFree = async () => {
    if (switching) return;
    setSwitching(true);
    setError("");
    try { await setProTestingPlan("free"); }
    catch { setError("Could not switch to Free. Please try again."); }
    finally { setSwitching(false); }
  };
  const freeButton = plan.development && <button type="button" className="ss-membership-free-button"
    disabled={switching} onClick={() => void previewFree()}>{switching ? "Please wait…" : "Free"}</button>;
  return <SettingsHub includeStore={false} includeElite
    onEliteClick={plan.elite ? undefined : () => openPro("elite")}
    proAction={plan.enabled && plan.ready && <>
      {plan.elite ? freeButton : <div className="ss-membership-banner">
        <button type="button" className="ss-settings-pro-button" aria-label="Out Of Sight Membership" aria-haspopup="dialog"
          onClick={() => openPro(plan.pro ? "elite" : undefined)}>
          <strong>Out Of Sight Membership</strong>
          <span className="ss-membership-banner-features">
            <span>Takeoff alerts &amp; Live Tracking</span><span>Ride Mode &amp; ride summaries</span>
            <span>Aircraft flight paths</span><span>Rider profiles</span>
          </span>
        </button>
        {freeButton}
      </div>}
      {error && <p role="alert" className="ss-ride-error">{error}</p>}
    </>} />;
}
