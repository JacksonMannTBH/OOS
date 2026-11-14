"use client";

import { useEffect, useRef } from "react";
import type { RideGForceReading, RideGForceStatus, RideGForceSummary } from "@/lib/ride-recording";
import { useRideGForce } from "@/lib/hooks/useRideGForce";
import { RidePeaksResetButton } from "./RidePeaksResetButton";

type GForceResetProps = {
  onReset: () => void; resetting: boolean; resetDisabled: boolean; resetError: string;
};

export function RideGForceView(props: GForceResetProps) {
  const status = useRideGForce(true);
  return <RideGForce status={status} {...props} />;
}

export function RideGForcePeaks({ summary }: {
  summary: RideGForceSummary | null | undefined;
}) {
  return <dl className="ss-ride-statistics ss-gforce-peaks" aria-label="Peak G-force readings">
    {([
      ["Acceleration", summary?.maxAccelerationG], ["Braking", summary?.maxBrakingG],
      ["Left turn", summary?.maxLeftG], ["Right turn", summary?.maxRightG],
    ] as const).map(([label, value]) => <div key={label}>
      <dt>{label}</dt><dd>{summary?.sampleCount && value != null && Number.isFinite(value) ? value.toFixed(2) : "—"} <small>G</small></dd>
    </div>)}
  </dl>;
}

export function RideGForce({ status, onReset, resetting, resetDisabled, resetError }: { status: RideGForceStatus | null } & GForceResetProps) {
  const reading = status?.receiving && status.calibrated ? status.reading : null;
  const peak = (value: number | undefined) => status?.peaks?.sampleCount && value != null && Number.isFinite(value)
    ? `${value.toFixed(2)} G` : "— G";
  const message = !status ? "Connecting to motion sensors…"
    : !status.supported ? "G-force is available in the OOS iPhone app."
    : status.message || (!status.calibrated ? "Calibrate your phone" : !reading ? "Waiting for motion readings…" : "");
  return <section className="ss-gforce-view" aria-label="G-force meter">
    <svg className="ss-gforce-dial" viewBox="0 0 300 300" role="img" aria-label={
      `Peak acceleration ${peak(status?.peaks?.maxAccelerationG)}, braking ${peak(status?.peaks?.maxBrakingG)}, left turn ${peak(status?.peaks?.maxLeftG)}, right turn ${peak(status?.peaks?.maxRightG)}`}>
      <circle cx="150" cy="150" r="70" className="ss-gforce-ring ss-gforce-ring--inner" />
      <path d="M10 150h280M150 10v280" className="ss-gforce-crosshair" />
      {reading && <AnimatedGForcePlot reading={reading} />}
      <g className="ss-gforce-labels">
        <text x="150" y="24" textAnchor="middle">BRAKE<tspan x="150" dy="22" className="ss-gforce-peak">{peak(status?.peaks?.maxBrakingG)}</tspan></text>
        <text x="150" y="254" textAnchor="middle"><tspan className="ss-gforce-peak">{peak(status?.peaks?.maxAccelerationG)}</tspan><tspan x="150" dy="22">ACCEL</tspan></text>
        <text x="44" y="143" textAnchor="middle">L<tspan x="44" dy="23" className="ss-gforce-peak">{peak(status?.peaks?.maxLeftG)}</tspan></text>
        <text x="256" y="143" textAnchor="middle">R<tspan x="256" dy="23" className="ss-gforce-peak">{peak(status?.peaks?.maxRightG)}</tspan></text>
      </g>
    </svg>
    <RidePeaksResetButton className="ss-gforce-reset" label="Reset peak G-force"
      onClick={onReset} busy={resetting}
      disabled={resetDisabled || !status?.supported || !status.calibrated || !status.peaks?.sampleCount} />
    {(resetError || message) && <p className="ss-gforce-message" role={resetError ? "alert" : "status"}>{resetError || message}</p>}
  </section>;
}

function gForceScale(reading: RideGForceReading): number {
  return Math.max(1, Math.ceil(reading.combinedG * 2) / 2);
}

// Display animation only. Native readings and saved peaks never pass through it.
function AnimatedGForcePlot({ reading }: { reading: RideGForceReading }) {
  const target = useRef(reading);
  const initial = useRef({ reading, scale: gForceScale(reading) }).current;
  const dot = useRef<SVGCircleElement>(null);
  useEffect(() => { target.current = reading; }, [reading]);
  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let longitudinal = initial.reading.longitudinalG;
    let lateral = initial.reading.lateralG;
    let scale = initial.scale;
    let targetScale = scale;
    let lowerScale: { value: number; since: number } | null = null;
    let lastTime = performance.now();
    let frame = 0;
    const setPosition = (name: "cx" | "cy", value: number) => {
      const text = value.toFixed(3);
      if (dot.current && dot.current.getAttribute(name) !== text) dot.current.setAttribute(name, text);
    };
    const animate = (time: number) => {
      const latest = target.current;
      const requiredScale = gForceScale(latest);
      if (requiredScale > targetScale) {
        targetScale = requiredScale;
        lowerScale = null;
      } else if (requiredScale < targetScale) {
        if (lowerScale?.value !== requiredScale) lowerScale = { value: requiredScale, since: time };
        else if (time - lowerScale.since >= 1000) {
          targetScale = requiredScale;
          lowerScale = null;
        }
      } else {
        lowerScale = null;
      }
      // The elapsed-time response is consistent on both 60 Hz and 120 Hz screens.
      const blend = motionPreference.matches ? 1 : 1 - Math.exp(-(time - lastTime) / 200);
      longitudinal += (latest.longitudinalG - longitudinal) * blend;
      lateral += (latest.lateralG - lateral) * blend;
      scale += (targetScale - scale) * blend;
      if (Math.abs(latest.longitudinalG - longitudinal) < 0.0001) longitudinal = latest.longitudinalG;
      if (Math.abs(latest.lateralG - lateral) < 0.0001) lateral = latest.lateralG;
      if (Math.abs(targetScale - scale) < 0.0001) scale = targetScale;
      setPosition("cx", 150 + lateral / scale * 140);
      // The dot moves down under acceleration and up under braking.
      setPosition("cy", 150 + longitudinal / scale * 140);
      lastTime = time;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [initial]);
  return <circle ref={dot} className="ss-gforce-dot"
    cx={150 + initial.reading.lateralG / initial.scale * 140}
    cy={150 + initial.reading.longitudinalG / initial.scale * 140} r="8" />;
}
