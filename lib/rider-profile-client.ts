"use client";
import { Capacitor, registerPlugin } from "@capacitor/core";
import backend from "../mobile/backend.json";
import { getDevicePreference, updateDevicePreferences } from "./device-preferences";
import { RIDER_PREFERENCES_KEY, RIDER_PROFILE_CHANGED, validRiderIcon, type RiderPreferences, type RiderProfile } from "./rider-sharing";
const SERVER_PROFILE_KEY="oos_rider_server_profile";

const native = registerPlugin<{
  request(options: { method: string; path: string; body?: Record<string, unknown> }): Promise<{ profile: RiderProfile }>;
  setMembership(options: { enabled: boolean }): Promise<void>;
}>("OOSRiderSharing");
export const ridersBackendURL = backend.url.replace(/\/oos-app$/, "/oos-riders");
export function hasNativeRiderSharing() { return Capacitor.isPluginAvailable("OOSRiderSharing"); }
export async function setRiderMembership(enabled: boolean) { if (hasNativeRiderSharing()) await native.setMembership({ enabled }); }
const messages: Record<string, string> = {
  username_taken: "That username is already taken. Choose another.", elite_required: "Elite sharing is not active on this device yet.",
  invalid_profile: "Use up to 20 letters, numbers or underscores for your username.",
};
let pending: Promise<unknown> = Promise.resolve();
let localID: string | null = null;
export function ownRiderID() {
  if (!localID) { try { localID=JSON.parse(getDevicePreference(SERVER_PROFILE_KEY)??"null")?.id??null; } catch { /* No saved profile yet. */ } }
  return localID;
}
async function request(method: string, body?: Partial<RiderPreferences>): Promise<RiderProfile> {
  let result: { profile: RiderProfile };
  if (hasNativeRiderSharing()) {
    try { result = await native.request({ method, path: "profile", body }); }
    catch (error) { const message = error instanceof Error ? error.message : ""; throw new Error(messages[message] ?? "Your rider profile could not be saved. Please try again."); }
  } else {
    // Browser profiles are local to this browser installation. No account sync.
    const key = "oos_rider_installation_token";
    let token = window.localStorage.getItem(key);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
      window.localStorage.setItem(key, token);
    }
    const response = await fetch(`${ridersBackendURL}/profile`, { method, headers: { apikey: backend.publishableKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}), signal: AbortSignal.timeout(12_000), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(messages[data.error] ?? "Your rider profile could not be saved. Please try again.");
    result = data;
  }
  localID = result.profile.id;
  // The server response is authoritative. A local cache failure must not make
  // a successful privacy change appear to have failed or roll the UI back.
  const cache={ [SERVER_PROFILE_KEY]:JSON.stringify(result.profile),...(method==="PATCH"?{[RIDER_PREFERENCES_KEY]:JSON.stringify(result.profile)}:{}) };
  await updateDevicePreferences(cache).catch(()=>undefined);
  window.dispatchEvent(new CustomEvent(RIDER_PROFILE_CHANGED, { detail: result.profile }));
  return result.profile;
}
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = pending.catch(() => undefined).then(task); pending = next; return next;
}
export function loadRiderProfile(): Promise<RiderProfile> { return serialized(async () => {
  const saved = getDevicePreference(RIDER_PREFERENCES_KEY);
  const profile = await request("POST");
  // Import the existing local preview's name/icon, but never its default-on
  // visibility flags. Sharing requires a new, explicit choice on this device.
  if (!profile.username && profile.elite && saved) {
    try {
      const old = JSON.parse(saved) as RiderPreferences;
      if (old.username) return await request("PATCH", { username: old.username, icon: validRiderIcon(old.icon)?old.icon:"eye" });
    } catch { /* Keep the server profile and let the rider choose a valid name. */ }
  }
  return profile;
}); }
export function updateRiderProfile(changes: Partial<RiderPreferences>) { return serialized(() => request("PATCH", changes)); }
export async function stopRiderSharingForReset() {
  await setRiderMembership(false);
  if(ownRiderID())await updateRiderProfile({visible:false,shareSpeed:false});
}
