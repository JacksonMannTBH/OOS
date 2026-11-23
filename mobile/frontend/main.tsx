import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { initializeDevicePreferences } from "@/lib/device-preferences";
import { readAircraftTrackingPreferences } from "@/lib/aircraft-tracking";
import { applyColorMode, readColorMode } from "@/lib/color-mode";
import App from "./App";
import { connectBackend } from "./network";
import { connectNavigation } from "./navigation";
import { getContrastPref } from "./preferences";
import "../../app/globals.css";
import "../../app/monochrome.css";
connectBackend();
connectNavigation();
function Startup() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void initializeDevicePreferences().then(() => {
      // Do not render default selections or sync them upstream if saved data
      // could not be restored. The user can retry without losing their choices.
      readAircraftTrackingPreferences();
      applyColorMode(readColorMode());
      try { document.body.dataset.contrast = getContrastPref(); }
      catch { document.body.dataset.contrast = "normal"; }
      if (!cancelled) setReady(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [attempt]);
  if (ready) return <App />;
  if (!failed) return null;
  return <main style={{ padding: 32 }}>
    <p role="status">{failed ? "Could not restore your saved settings. Please try again." : "Restoring your settings…"}</p>
    {failed && <button onClick={() => setAttempt(value => value + 1)}>Try again</button>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Startup />);
