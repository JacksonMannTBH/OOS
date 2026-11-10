"use client";
import { getDevicePreference, initializeDevicePreferences, updateDevicePreferences } from "./device-preferences";
import { getCurrentDevicePosition } from "./device-location";
import { POLICE_REFRESH_EVENT } from "./hooks/usePoliceSightings";

let identity: Promise<string> | null = null;
async function reporterToken(): Promise<string> {
  return identity ??= (async () => {
    await initializeDevicePreferences();
    const existing = getDevicePreference("oos_police_reporter_token");
    if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
    await updateDevicePreferences({ oos_police_reporter_token: token });
    return token;
  })().finally(() => { identity = null; });
}

export type PoliceVote = "still_here" | "not_seen";
export type PoliceReportResult = { status: "reported" | "duplicate" | "cooldown" | "voted" | "nearby" | "clear" | "confirmation_required" | "gone" | "too_far"; sightingId?: string; reportId?: string; retryAfterMs?: number; removed?: boolean };
async function request(method: string, body: Record<string, unknown>): Promise<PoliceReportResult> {
  const response = await fetch("/api/police", {
    method, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, reporterToken: await reporterToken() }), signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("Couldn’t report. Try again.");
  const data = await response.json();
  if (body.action !== "prepare") window.dispatchEvent(new Event(POLICE_REFRESH_EVENT));
  return data;
}

async function locatedRequest(body: Record<string, unknown>): Promise<PoliceReportResult> {
  // Capture a fresh fix at the tap, never the map center or the selected state.
  const position = await getCurrentDevicePosition({ enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 });
  if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 100 || Date.now() - position.timestamp > 15_000) {
    throw new Error("Waiting for a precise location. Try again.");
  }
  return request("POST", { ...body, lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: position.timestamp });
}

export const preparePoliceReport = () => locatedRequest({ action: "prepare" });
export const reportPolice = () => locatedRequest({ action: "report" });
export const votePolice = (sightingId: string, vote: PoliceVote) => locatedRequest({ action: "vote", sightingId, vote });
