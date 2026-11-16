import { Capacitor, registerPlugin } from "@capacitor/core";

export type ProFeature = "ride" | "stats" | "live" | "notifications" | "paths" | "nationwide" | "elite";
export type ProStatus = {
  ready: boolean;
  enabled: boolean;
  pro: boolean;
  elite: boolean;
  development: boolean;
  testingPlan: "free" | "pro" | "elite" | "store";
  productAvailable: boolean;
  displayPrice: string | null;
  trialEligible?: boolean;
  expiresAt: number | null;
};
// Only a confirmed StoreKit eligibility result can advertise the introductory trial.
export function proTrialAvailable(plan: Pick<ProStatus, "ready" | "pro" | "trialEligible">): boolean {
  return plan.ready && !plan.pro && plan.trialEligible === true;
}

export const PRO_CHANGED = "oos:pro-changed";
export const PRO_REQUESTED = "oos:pro-requested";
// Memberships are an iPhone Debug preview. Until billing/server verification ships,
// builds without this native preview retain the existing unrestricted access.
const initial: ProStatus = { enabled: Capacitor.isPluginAvailable("OOSPro"), ready: false, elite: false, pro: !Capacitor.isPluginAvailable("OOSPro"), development: false, testingPlan: "store", productAvailable: false, displayPrice: null, expiresAt: null };
let status = initial;
const listeners = new Set<() => void>();
const billing = registerPlugin<{
  status(): Promise<ProStatus>;
  purchase(): Promise<ProStatus & { outcome?: "cancelled" | "pending" }>;
  restore(): Promise<ProStatus>;
  manage(): Promise<void>;
  setTestingPlan(options: { plan: "free" | "pro" | "elite" | "store" }): Promise<ProStatus>;
}>("OOSPro");

export function proSnapshot() { return status; }
export function proServerSnapshot() { return initial; }
export function subscribePro(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function publish(next: ProStatus) {
  const tierChanged = status.pro !== next.pro || status.elite !== (next.elite ?? false);
  status = { ...next, elite: next.elite ?? false, enabled: Capacitor.isPluginAvailable("OOSPro"), ready: true };
  listeners.forEach(listener => listener());
  if (typeof window !== "undefined" && window.dispatchEvent) {
    window.dispatchEvent(new Event(PRO_CHANGED));
    if (tierChanged) window.dispatchEvent(new Event("oos:pro-tier-changed"));
  }
  return status;
}
let refresh: Promise<ProStatus> | null = null;
export function refreshPro(): Promise<ProStatus> {
  return refresh ??= (async () => {
    if (!Capacitor.isPluginAvailable("OOSPro")) return publish({ ...initial, ready: true });
    return publish(await billing.status());
  })().finally(() => { refresh = null; });
}
export function openPro(feature?: ProFeature) {
  if (!status.enabled) return;
  window.dispatchEvent(new CustomEvent(PRO_REQUESTED, { detail: { feature } }));
}
export async function requirePro(feature: ProFeature): Promise<boolean> {
  const current = await refreshPro();
  if (feature === "elite" ? current.elite : current.pro) return true;
  openPro(feature);
  return false;
}
export async function assertPro(feature: ProFeature) {
  if (!await requirePro(feature)) throw new Error("OOS Pro is required for this feature.");
}
export async function purchasePro() {
  const result = await billing.purchase();
  publish(result);
  return result.outcome;
}
export async function restorePro() { return publish(await billing.restore()); }
export async function managePro() { await billing.manage(); await refreshPro(); }
export async function setProTestingPlan(plan: "free" | "pro" | "elite" | "store") {
  // A JS preference cannot grant access: the native plugin enforces Debug-only overrides.
  const result = await billing.setTestingPlan({ plan });
  return publish(result);
}
