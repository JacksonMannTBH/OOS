"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePro } from "@/lib/hooks/usePro";
import { PRO_REQUESTED, proTrialAvailable, openPro, refreshPro, purchasePro, restorePro, managePro, setProTestingPlan, type ProFeature } from "@/lib/pro-access";
import { useRideRecorder } from "@/lib/hooks/useRideRecorder";
import { RideDialog } from "./RideDialog";
import { SettingsPageShell } from "./SettingsPageShell";
import { StateSelector } from "./StateSelector";
import { SettingsCard } from "./SettingsCard";

export function ProBadge({ className = "" }: { className?: string }) {
  const plan = usePro();
  return plan.enabled && plan.ready && !plan.pro && !plan.elite
    ? <span className={`ss-pro-badge ${className}`.trim()}>Pro</span>
    : null;
}

export function EliteBadge() {
  const plan = usePro();
  return plan.enabled && plan.ready && !plan.elite
    ? <span className="ss-pro-badge ss-elite-badge">Elite</span>
    : null;
}

export function ProProvider({ children }: { children: ReactNode }) {
  const plan = usePro();
  const [paywall, setPaywall] = useState<{ feature?: ProFeature } | null>(null);
  useEffect(() => {
    if (!plan.enabled) return;
    const show = (event: Event) => setPaywall((event as CustomEvent).detail ?? {});
    const update = () => { if (document.visibilityState === "visible") void refreshPro().catch(() => {}); };
    window.addEventListener(PRO_REQUESTED, show);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    const timer = window.setInterval(update, 30000);
    update();
    return () => { window.removeEventListener(PRO_REQUESTED, show); window.removeEventListener("online", update); document.removeEventListener("visibilitychange", update); clearInterval(timer); };
  }, [plan.enabled]);
  return <>{children}{paywall && <RideDialog title="Out Of Sight Membership" className="ss-pro-dialog" dismissOnBackdrop onClose={() => setPaywall(null)}>
    <ProDetails key={paywall.feature ?? "membership"} initialPlan={paywall.feature === "elite" ? "elite" : undefined} onClose={() => setPaywall(null)} />
  </RideDialog>}</>;
}

export function ProDetails({ onClose, initialPlan }: { onClose?: () => void; initialPlan?: "pro" | "elite" }) {
  const plan = usePro();
  const [selected, setSelected] = useState<"pro" | "elite">(initialPlan ?? (plan.elite ? "elite" : "pro"));
  const tabsId = useId();
  const trial = selected === "pro" && proTrialAvailable(plan);
  const price = selected === "elite" ? "$9.99" : plan.development ? "$4.99" : plan.displayPrice ?? "$4.99";
  const actionLabel = trial ? "Free Trial Week" : `${price}/month`;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  const active = selected === "elite" ? plan.elite : plan.pro && !plan.elite;
  return <div className="ss-pro-details">
    <div className="ss-membership-tabs" role="tablist" aria-label="Membership plan">
      {(["pro", "elite"] as const).map(tier => <button key={tier} type="button" role="tab"
        id={`${tabsId}-${tier}`} aria-selected={selected === tier} aria-controls={`${tabsId}-panel`}
        tabIndex={selected === tier ? 0 : -1} onClick={() => { setSelected(tier); setMessage(""); }}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "pro" : event.key === "End" ? "elite" : selected === "pro" ? "elite" : "pro";
          setSelected(next); setMessage("");
          document.getElementById(`${tabsId}-${next}`)?.focus();
        }}>{tier === "pro" ? "Pro" : "Elite"}</button>)}
    </div>
    <section className="ss-membership-plan" id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${selected}`}>
      {selected === "pro" ? <>
        <ul className="ss-pro-benefits">
          <li>Takeoff notifications</li><li>Live Tracking Notification</li><li>Aircraft path lines</li><li>Ride mode and ride summaries</li><li>All-time ride stats</li>
        </ul>
      </> : <>
        <ul className="ss-pro-benefits">
          <li>Everything in Pro</li><li>Your rider profile and username</li><li>Custom rider icons</li><li>Map visibility controls</li><li>Speed Sharing</li>
        </ul>
      </>}
      {plan.development ? <button type="button" className="ss-ride-primary" aria-pressed={active} disabled={busy || !plan.ready || active}
        onClick={() => void run(() => setProTestingPlan(selected))}>{busy ? "Please wait…" : actionLabel}</button>
      : selected === "pro" && <>
        {plan.pro ? <button className="ss-ride-primary" disabled={busy} onClick={() => void run(managePro)}>Manage Subscription</button>
        : <button className="ss-ride-primary" disabled={busy || !plan.ready || !plan.productAvailable} onClick={() => void run(async () => {
          const outcome = await purchasePro();
          if (outcome === "pending") setMessage("Your purchase is awaiting approval.");
          else if (outcome !== "cancelled") onClose?.();
        })}>{busy ? "Please wait…" : actionLabel}</button>}
      </>}
      <p className="ss-pro-fine">{trial ? `After 1 week free, ${price}/month. ` : ""}Renews automatically until canceled. Cancel in your Apple account settings.</p>
      <div className="ss-pro-links">
        {!plan.development && <button disabled={busy} onClick={() => void run(async () => { const result = await restorePro(); setMessage(result.pro ? "Membership restored." : "No active subscription found."); })}>Restore Purchases</button>}
        <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer">Terms</a>
        <a href="https://outofsight.live/legal" target="_blank" rel="noreferrer">Privacy</a>
      </div>
      {message && <p role="status" className="ss-ride-error">{message}</p>}
    </section>
  </div>;
}

export function ProFeatureGate({ children, feature, title }: { children: ReactNode; feature: ProFeature; title: string }) {
  const plan = usePro();
  if (plan.pro) return <>{children}</>;
  return <section className="ss-pro-locked"><p>{title} <ProBadge /></p><button className="ss-ride-primary" onClick={() => openPro(feature)}>Explore Pro</button></section>;
}

export function ProRideBoundary({ children }: { children: ReactNode }) {
  const { status } = useRideRecorder();
  const plan = usePro();
  // Existing rides can always be finished and saved, even after access expires.
  if (status?.active || plan.pro) return <>{children}</>;
  return <SettingsPageShell title="Ride mode"><ProFeatureGate feature="ride" title="Record rides and view your stats">{children}</ProFeatureGate></SettingsPageShell>;
}

export function ProStatsBoundary({ children }: { children: ReactNode }) {
  const plan = usePro();
  const router = useRouter();
  useEffect(() => {
    if (plan.ready && !plan.pro) {
      router.replace("/settings");
      queueMicrotask(() => openPro("stats"));
    }
  }, [plan.ready, plan.pro, router]);
  return plan.pro ? <>{children}</> : null;
}

export function FreeAlertsSettings() {
  return <SettingsCard title="Takeoff notifications" headerAccessory={<ProBadge />}><label>State<StateSelector style={{ width: "100%", minHeight: 48, borderRadius: 12 }} /></label>
    <button className="ss-ride-primary" onClick={() => openPro("notifications")}>Explore Pro</button>
  </SettingsCard>;
}
