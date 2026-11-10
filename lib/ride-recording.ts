import { Capacitor, registerPlugin } from "@capacitor/core";
import { assignLiveTrackingToRide, stopRideLiveTracking } from "./live-tracking";

export type RideRoutePoint = { latitude: number; longitude: number; startsSegment: boolean };
export type RecordedRide = {
  id: string;
  startedAt: number;
  updatedAt: number;
  endedAt: number | null;
  distanceMeters: number;
  topSpeedMps: number | null;
  durationSeconds: number;
  sampleCount: number;
  hasGaps: boolean;
  interrupted: boolean;
  route?: RideRoutePoint[];
};
export type RideRecorderStatus = {
  supported: boolean;
  consentRequired: boolean;
  active: RecordedRide | null;
  rides: RecordedRide[];
  receivingLocation: boolean;
  message: string;
};
export const RIDE_RECORDING_CHANGED = "oos:ride-recording";
const recorder = registerPlugin<{
  status(): Promise<RideRecorderStatus>;
  start(options: { consent: boolean }): Promise<RideRecorderStatus>;
  finish(options: { id: string }): Promise<{ ride: RecordedRide }>;
  delete(options: { id: string }): Promise<RideRecorderStatus>;
}>("OOSRideRecorder");

export function hasRideRecorder(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("OOSRideRecorder");
}
function changed() { window.dispatchEvent(new Event(RIDE_RECORDING_CHANGED)); }
export async function getRideRecorderStatus(): Promise<RideRecorderStatus> {
  if (hasRideRecorder()) return recorder.status();
  return { supported: false, consentRequired: false, active: null, rides: [], receivingLocation: false, message: "" };
}
export async function startRideRecording(consent = false, startedLiveTracking = false): Promise<RideRecorderStatus> {
  const status = await recorder.start({ consent });
  if (startedLiveTracking && status.active) await assignLiveTrackingToRide(status.active.id);
  changed();
  return status;
}
export async function finishRideRecording(id: string): Promise<RecordedRide> {
  await stopRideLiveTracking(id);
  const { ride } = await recorder.finish({ id });
  changed();
  return ride;
}
export async function deleteRecordedRide(id: string): Promise<void> {
  await recorder.delete({ id });
  changed();
}
