"use client";

import { useId } from "react";
import type { RideLeanStatus } from "@/lib/ride-recording";
import { useRideLean } from "@/lib/hooks/useRideLean";
import { formatPitchDegrees, projectPitchHorizon } from "@/lib/ride-pitch-display";
import { RideCalibrationIcon } from "./RideCalibrationIcon";
import { RidePeaksResetButton } from "./RidePeaksResetButton";

type PitchResetProps = {
  onReset: () => void; resetting: boolean; resetDisabled: boolean; resetError: string;
};

export function RidePitchHorizonView(props: PitchResetProps) {
  return <RidePitchHorizon status={useRideLean(true, "Pitch")} {...props} />;
}

export function RidePitchHorizon({ status, onReset, resetting, resetDisabled, resetError }: { status: RideLeanStatus | null } & PitchResetProps) {
  const clipId = useId();
  const raw = status?.calibrated && status.receiving ? status.reading?.pitchDegrees : null;
  const pitch = raw != null && Number.isFinite(raw) ? raw : null;
  const horizon = pitch == null ? null : projectPitchHorizon(pitch);
  const value = formatPitchDegrees(pitch);
  const peak = status?.peaks?.sampleCount ? formatPitchDegrees(status.peaks.maxPitchDegrees) : "—";
  const message = !status ? "Connecting to motion sensors…"
    : !status.supported ? "Moving horizon is available in the OOS iPhone app."
    : status.message || (!status.calibrated ? <>Use <RideCalibrationIcon /><span className="sr-only">the level button</span> to measure</> : pitch == null ? "Waiting for motion readings…" : "");
  const centerTick = Math.round((pitch ?? 0) / 15) * 15;

  return <section className="ss-gforce-view ss-pitch-view" aria-label="Moving horizon">
    <svg className="ss-gforce-dial ss-pitch-dial" viewBox="0 0 300 300" role="img"
      aria-label={`Pitch ${value}. Maximum pitch ${peak}. The center marker stays fixed while the level horizon moves.`}>
      <defs><clipPath id={clipId}><circle cx="150" cy="150" r="147" /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        <circle cx="150" cy="150" r="147" className="ss-pitch-sky" />
        {horizon && <>
          <g className="ss-pitch-horizon" style={{ transform: `translateY(${125 + horizon.offset}px)`, transition: Math.abs(horizon.offset) > 300 ? "none" : undefined }}>
            <rect x="0" y={horizon.groundAbove ? -2000 : 0} width="300" height="2000" className="ss-pitch-ground" />
            <path d="M0 0H300" className="ss-pitch-level" />
            <text x="34" y="-7" className="ss-pitch-label">0°</text>
            <text x="266" y="-7" textAnchor="end" className="ss-pitch-label">0°</text>
          </g>
          {Array.from({ length: 9 }, (_, index) => centerTick + (index - 4) * 15).map(tick => {
            const relative = (pitch ?? 0) - tick;
            if (Math.abs(relative) > 60 || tick === 0) return null;
            const y = 125 + Math.tan(relative * Math.PI / 180) * 85;
            if (y < 56 || y > 170) return null;
            return <g key={tick} className="ss-pitch-tick" transform={`translate(0 ${y})`}>
              <path d={tick % 30 === 0 ? "M117 0H183" : "M129 0H171"} />
              {tick % 30 === 0 && <text x="150" y="-6" textAnchor="middle" className="ss-pitch-label">{formatPitchDegrees(tick)}</text>}
            </g>;
          })}
        </>}
        <text x="150" y="35" textAnchor="middle" className="ss-pitch-label ss-pitch-title">PITCH</text>
        <path d="M82 125H123L134 136H166L177 125H218" className="ss-pitch-reference" />
        <circle cx="150" cy="125" r="3" className="ss-pitch-reference-dot" />
        <rect x="28" y="190" width="244" height="95" rx="22" className="ss-pitch-readout-background" />
        <text x="150" y="249" textAnchor="middle" className="ss-pitch-value"
          style={value.length > 5 ? { fontSize: 54 } : undefined}>{value}</text>
        <text x="150" y="274" textAnchor="middle" className="ss-pitch-label">MAX PITCH <tspan className="ss-pitch-peak">{peak}</tspan></text>
      </g>
    </svg>
    <RidePeaksResetButton className="ss-gforce-reset" label="Reset peak angles"
      onClick={onReset} busy={resetting}
      disabled={resetDisabled || !status?.supported || !status.calibrated || !status.recordingPeaks || !status.peaks?.sampleCount} />
    {(resetError || message) && <p className="ss-gforce-message ss-pitch-message" role={resetError ? "alert" : "status"}>{resetError || message}</p>}
    {status?.calibrated && !status.recordingPeaks && !message && !resetError && <p className="ss-lean-recording-note">Peak recording off</p>}
  </section>;
}
