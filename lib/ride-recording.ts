import { Capacitor, registerPlugin } from "@capacitor/core";
import { assignLiveTrackingToRide, stopRideLiveTracking } from "./live-tracking";
import { readRideAnglesEnabled } from "./ride-motion-settings";
import { waitForRideCalibration } from "./ride-calibration";

export type RideMotionSummary = {
  calibratedAt: number;
  maxLeftRollDegrees: number;
  maxRightRollDegrees: number;
  maxPitchDegrees: number;
  sampleCount: number;
};
export type RideMotionStatus = {
  supported: boolean;
  enabled: boolean;
  calibrated: boolean;
  gForceCalibrated?: boolean;
  message: string;
};

export type RideGForceSummary = {
  calibratedAt: number;
  maxAccelerationG: number;
  maxBrakingG: number;
  maxLeftG: number;
  maxRightG: number;
  sampleCount: number;
};
export type RideGForceReading = {
  timestamp: number;
  longitudinalG: number;
  lateralG: number;
  combinedG: number;
};
export type RideGForceStatus = {
  supported: boolean;
  calibrated: boolean;
  receiving: boolean;
  reading: RideGForceReading | null;
  peaks: RideGForceSummary | null;
  message: string;
};

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
  motion?: RideMotionSummary | null;
  gForce?: RideGForceSummary | null;
};
export type RideLifetimeStats = {
  rideCount: number;
  topSpeedMps: number | null;
  longestDistanceMeters: number | null;
  longestDurationSeconds: number;
};
export type RideRecorderStatus = {
  supported: boolean;
  consentRequired: boolean;
  active: RecordedRide | null;
  rides: RecordedRide[];
  receivingLocation: boolean;
  message: string;
  motion?: RideMotionStatus;
  lifetimeStats?: RideLifetimeStats;
};
export const RIDE_RECORDING_CHANGED = "oos:ride-recording";
const recorder = registerPlugin<{
  status(): Promise<RideRecorderStatus>;
  gForceStatus(): Promise<RideGForceStatus>;
  start(options: { consent: boolean; recordAngles: boolean }): Promise<RideRecorderStatus>;
  configureMotion(options: { enabled: boolean }): Promise<RideMotionStatus>;
  calibrateMotion(options: { rideId: string }): Promise<RideMotionStatus>;
  resetMotionPeaks(options: { rideId: string }): Promise<RideRecorderStatus>;
  resetGForcePeaks(options: { rideId: string }): Promise<RideRecorderStatus>;
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

export async function getRideGForceStatus(): Promise<RideGForceStatus> {
  if (hasRideRecorder()) return recorder.gForceStatus();
  return { supported: false, calibrated: false, receiving: false, reading: null, peaks: null, message: "" };
}
export async function startRideRecording(consent = false, startedLiveTracking = false): Promise<RideRecorderStatus> {
  const status = await recorder.start({ consent, recordAngles: readRideAnglesEnabled() });
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

export async function configureRideMotion(enabled: boolean): Promise<RideMotionStatus | null> {
  if (!hasRideRecorder()) return null;
  const status = await recorder.configureMotion({ enabled });
  changed();
  return status;
}

export async function calibrateRideMotion({ rideId, signal }: { rideId: string; signal: AbortSignal }): Promise<RideMotionStatus> {
  const status = await waitForRideCalibration(() => recorder.calibrateMotion({ rideId }), signal);
  changed();
  return status;
}

export async function resetRideMotionPeaks(rideId: string): Promise<void> {
  await recorder.resetMotionPeaks({ rideId });
  changed();
}

export async function resetRideGForcePeaks(rideId: string): Promise<void> {
  await recorder.resetGForcePeaks({ rideId });
  changed();
}
