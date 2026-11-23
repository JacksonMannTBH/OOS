"use client";

import type { RideLeanStatus } from "@/lib/ride-recording";
import { useRideLean } from "@/lib/hooks/useRideLean";
import { RideCalibrationIcon } from "./RideCalibrationIcon";
import { RidePeaksResetButton } from "./RidePeaksResetButton";

type LeanResetProps = {
  onReset: () => void; resetting: boolean; resetDisabled: boolean; resetError: string;
};

export function RideLeanArcView(props: LeanResetProps) {
  return <RideLeanArc status={useRideLean(true)} {...props} />;
}

const limit = (angle: number) => Math.max(-60, Math.min(60, angle));
function point(angle: number, radius: number) {
  const radians = angle * Math.PI / 180;
  return { x: 150 + Math.sin(radians) * radius, y: 200 - Math.cos(radians) * radius };
}
function mark(angle: number, inner: number, outer: number) {
  const a = point(angle, inner), b = point(angle, outer);
  return `M${a.x} ${a.y}L${b.x} ${b.y}`;
}

export function RideLeanArc({ status, onReset, resetting, resetDisabled, resetError }: { status: RideLeanStatus | null } & LeanResetProps) {
  const raw = status?.calibrated && status.receiving ? status.reading?.rollDegrees : null;
  const angle = raw != null && Number.isFinite(raw) ? raw : null;
  const rounded = angle == null ? null : Math.round(Math.abs(angle));
  const direction = rounded === 0 ? "UPRIGHT" : angle == null ? "LEAN ANGLE" : angle < 0 ? "LEFT" : "RIGHT";
  const end = point(limit(angle ?? 0), 126);
  const peak = (value: number | undefined) => status?.peaks?.sampleCount && value != null && Number.isFinite(value) ? `${Math.round(value)}°` : "—";
  const message = !status ? "Connecting to motion sensors…"
    : !status.supported ? "Lean arc is available in the OOS iPhone app."
    : status.message || (!status.calibrated ? <>Use <RideCalibrationIcon /><span className="sr-only">the level button</span> to measure</> : angle == null ? "Waiting for motion readings…" : "");

  return <section className="ss-gforce-view ss-lean-view" aria-label="Lean arc">
    <svg className="ss-gforce-dial ss-lean-dial" viewBox="0 0 300 300" role="img"
      aria-label={`Lean arc, scale 60 degrees left to 60 degrees right. ${angle == null ? "No current reading." : `${rounded} degrees ${direction.toLowerCase()}.`} Peak left ${peak(status?.peaks?.maxLeftRollDegrees)}, peak right ${peak(status?.peaks?.maxRightRollDegrees)}.`}>
      <text x="150" y="36" textAnchor="middle" className="ss-lean-label">LEAN</text>
      <path d="M40.88 137 A126 126 0 0 1 259.12 137" className="ss-lean-track" />
      <path d="M150 74V200" className="ss-lean-center" />
      {[-60, -45, -30, -15, 0, 15, 30, 45, 60].map(tick =>
        <path key={tick} d={mark(tick, 118, tick % 30 === 0 ? 133 : 129)} className="ss-lean-tick" />)}
      <g className="ss-lean-label">
        <text x="150" y="64" textAnchor="middle">0°</text>
        <text x="37" y="159" textAnchor="middle">60° L</text>
        <text x="263" y="159" textAnchor="middle">R 60°</text>
      </g>
      {!!status?.peaks?.sampleCount && <g className="ss-lean-peak-marks">
        <path d={mark(-limit(status.peaks.maxLeftRollDegrees), 136, 143)} />
        <path d={mark(limit(status.peaks.maxRightRollDegrees), 136, 143)} />
      </g>}
      {angle != null && <g className="ss-lean-active">
        <path d={`M150 74 A126 126 0 0 ${angle < 0 ? 0 : 1} ${end.x} ${end.y}`} className="ss-lean-fill" />
        <line x1="150" y1="200" x2="150" y2="88" className="ss-lean-needle"
          style={{ transform: `rotate(${limit(angle)}deg)` }} />
        <circle cx="150" cy="200" r="4" />
      </g>}
      <text x="150" y="236" textAnchor="middle" className="ss-lean-value">{rounded == null ? "—" : `${rounded}°`}</text>
      <text x="150" y="254" textAnchor="middle" className="ss-lean-label">{direction}</text>
      <text x="110" y="272" textAnchor="middle" className="ss-lean-label">MAX L <tspan className="ss-lean-peak">{peak(status?.peaks?.maxLeftRollDegrees)}</tspan></text>
      <text x="190" y="272" textAnchor="middle" className="ss-lean-label">MAX R <tspan className="ss-lean-peak">{peak(status?.peaks?.maxRightRollDegrees)}</tspan></text>
    </svg>
    <RidePeaksResetButton className="ss-gforce-reset" label="Reset peak Lean and Pitch"
      onClick={onReset} busy={resetting}
      disabled={resetDisabled || !status?.supported || !status.calibrated || !status.recordingPeaks || !status.peaks?.sampleCount} />
    {(resetError || message) && <p className="ss-gforce-message ss-lean-message" role={resetError ? "alert" : "status"}>{resetError || message}</p>}
    {status?.calibrated && !status.recordingPeaks && !message && !resetError && <p className="ss-lean-recording-note">Peak recording off</p>}
  </section>;
}
