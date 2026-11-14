import { useEffect, useState } from "react";
import { testRecovery, testStatus } from "./phone-client";

export function PhoneBanner() {
  const [status, setStatus] = useState(testStatus);
  const [details, setDetails] = useState(false);
  useEffect(() => { const changed = () => setStatus(testStatus()); window.addEventListener("oos-test-status", changed); return () => window.removeEventListener("oos-test-status", changed); }, []);
  // Home and map screens paint fixed full-screen backgrounds. Keep the test
  // control in its own layer, clear of the home screen's bottom action buttons.
  return <aside aria-label="OOS Test diagnostics" style={{ position: "fixed", bottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)", left: 16, right: 16, margin: "0 auto", maxWidth: 360, zIndex: 2147483647, padding: "0 12px", border: "1px solid #f6c453", borderRadius: 14, boxShadow: "0 4px 24px #0009", background: "#553615", color: "#fff5df", fontSize: 12, textAlign: "center" }}>
    <button type="button" aria-expanded={details} aria-controls="oos-test-details" onClick={() => setDetails(!details)} style={{ display: "block", width: "100%", minHeight: 44, padding: "8px 0", font: "inherit", fontWeight: 700, color: "inherit", background: "transparent", border: 0 }}>OOS TEST · {status.connection} {details ? "▾" : "▴"}</button>
    {details && <div id="oos-test-details" style={{ padding: "0 0 12px", lineHeight: 1.7 }}>
      <div>{status.tests} checks passed · {status.updates} updates received · {status.recovered} recoveries</div>
      <div>Recorded flights from your Mac. Keep both devices on the same Wi-Fi.</div>
      <button type="button" onClick={testRecovery} style={{ color: "#fff", background: "#33200c", border: "1px solid #fff8", borderRadius: 8, minHeight: 44, padding: "7px 14px", marginTop: 8 }}>Test recovery</button>
    </div>}
  </aside>;
}
