"use client";

import { useEffect, useRef } from "react";
import type { RideGForceReading, RideGForceStatus, RideGForceSummary } from "@/lib/ride-recording";
import { useRideGForce } from "@/lib/hooks/useRideGForce";
import { RidePeaksResetButton } from "./RidePeaksResetButton";
import { RideCalibrationIcon } from "./RideCalibrationIcon";

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
      ["Left", summary?.maxLeftG], ["Right", summary?.maxRightG],
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
    : status.message || (!status.calibrated ? <>Use <RideCalibrationIcon /><span className="sr-only">the level button</span> to measure</> : !reading ? "Waiting for motion readings…" : "");
  return <section className="ss-gforce-view" aria-label="G-force meter">
    <svg className="ss-gforce-dial" viewBox="0 0 300 300" role="img" aria-label={
      `Fixed G-force scale: center 0 G, inner ring 0.5 G, outer edge 1 G. Peak acceleration ${peak(status?.peaks?.maxAccelerationG)}, braking ${peak(status?.peaks?.maxBrakingG)}, left G-force ${peak(status?.peaks?.maxLeftG)}, right G-force ${peak(status?.peaks?.maxRightG)}`}>
      <circle cx="150" cy="150" r="70" className="ss-gforce-ring ss-gforce-ring--inner" />
      <path d="M10 150h280M150 10v280" className="ss-gforce-crosshair" />
      {reading && <AnimatedGForcePlot key={status?.peaks?.calibratedAt ?? "current"} reading={reading} />}
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

function gForcePosition(longitudinal: number, lateral: number) {
  // Fixed 1 G radius. Clamp only this point to the edge, preserving direction;
  // another reading can never resize the existing trail or recorded peaks.
  const factor = 140 / Math.max(1, Math.hypot(longitudinal, lateral));
  return { x: 150 - lateral * factor, y: 150 + longitudinal * factor };
}

// Display animation only. Native readings and saved peaks never pass through it.
function AnimatedGForcePlot({ reading }: { reading: RideGForceReading }) {
  const target = useRef(reading);
  const initial = useRef(reading).current;
  const initialPosition = gForcePosition(initial.longitudinalG, initial.lateralG);
  const dot = useRef<SVGCircleElement>(null);
  const trail = useRef<Array<SVGPathElement | null>>([]);
  useEffect(() => { target.current = reading; }, [reading]);
  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let longitudinal = initial.longitudinalG;
    let lateral = initial.lateralG;
    let lastTime = performance.now();
    let frame = 0;
    const samples: Array<{ time: number; longitudinal: number; lateral: number }> = [];
    const trailDuration = 3000;
    const setPosition = (name: "cx" | "cy", value: number) => {
      const text = value.toFixed(3);
      if (dot.current && dot.current.getAttribute(name) !== text) dot.current.setAttribute(name, text);
    };
    const animate = (time: number) => {
      const latest = target.current;
      // The elapsed-time response is consistent on both 60 Hz and 120 Hz screens.
      const blend = motionPreference.matches ? 1 : 1 - Math.exp(-(time - lastTime) / 200);
      longitudinal += (latest.longitudinalG - longitudinal) * blend;
      lateral += (latest.lateralG - lateral) * blend;
      if (Math.abs(latest.longitudinalG - longitudinal) < 0.0001) longitudinal = latest.longitudinalG;
      if (Math.abs(latest.lateralG - lateral) < 0.0001) lateral = latest.lateralG;
      // Show outward inertial load, opposite the bike's horizontal acceleration:
      // left turn -> right, right turn -> left, acceleration -> down, brake -> up.
      // The L/R peaks use this same load direction.
      const position = gForcePosition(longitudinal, lateral);
      setPosition("cx", position.x);
      setPosition("cy", position.y);
      if (!samples.length || time - samples[samples.length - 1]!.time >= 50) {
        samples.push({ time, longitudinal, lateral });
      }
      while (samples.length && time - samples[0]!.time > trailDuration) samples.shift();
      const paths = Array<string>(6).fill("");
      for (let index = 1; index < samples.length; index++) {
        const previous = samples[index - 1]!, sample = samples[index]!;
        const bucket = Math.min(5, Math.floor((1 - (time - sample.time) / trailDuration) * 6));
        const coordinates = (point: typeof sample) => {
          const position = gForcePosition(point.longitudinal, point.lateral);
          return `${position.x.toFixed(2)} ${position.y.toFixed(2)}`;
        };
        paths[bucket] += `M${coordinates(previous)}L${coordinates(sample)}`;
      }
      paths.forEach((path, index) => trail.current[index]?.setAttribute("d", path));
      lastTime = time;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [initial]);
  return <><g className="ss-gforce-trail" aria-hidden="true">
    {Array.from({ length: 6 }, (_, index) => <path key={index} ref={element => { trail.current[index] = element; }} opacity={(index + 1) / 6 * 0.65} />)}
  </g><circle ref={dot} className="ss-gforce-dot"
    cx={initialPosition.x} cy={initialPosition.y} r="8" /></>;
}
