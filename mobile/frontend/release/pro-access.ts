import type { ProFeature, ProStatus } from "../../../lib/pro-access";
export type { ProFeature, ProStatus } from "../../../lib/pro-access";

// Existing features remain available while memberships are held for a later release.
const status: ProStatus = Object.freeze({ ready: true, enabled: false, pro: true,
  elite: false, development: false, testingPlan: "store", productAvailable: false,
  displayPrice: null, trialEligible: false, expiresAt: null });
export const PRO_CHANGED = "oos:pro-changed";
export const PRO_REQUESTED = "oos:pro-requested";
export const proSnapshot = () => status;
export const proServerSnapshot = proSnapshot;
export const subscribePro = (_listener: () => void) => () => {};
export const refreshPro = async () => status;
export const proTrialAvailable = (_plan: Pick<ProStatus, "ready" | "pro" | "trialEligible">) => false;
export const openPro = (_feature?: ProFeature) => {};
export const requirePro = async (feature: ProFeature) => feature !== "elite";
export async function assertPro(feature: ProFeature) {
  if (!await requirePro(feature)) throw new Error("This feature is not available in this release.");
}
async function unavailable(): Promise<never> { throw new Error("Purchases are not available in this release."); }
export const purchasePro = unavailable;
export const restorePro = unavailable;
export const managePro = unavailable;
export const setProTestingPlan = (_plan: "free" | "pro" | "elite" | "store") => unavailable();
