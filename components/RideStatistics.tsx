import type { RecordedRide } from "@/lib/ride-recording";
import { rideDistance, rideDuration, rideSpeed } from "@/lib/ride-history-format";
import { RideCalibrationIcon } from "./RideCalibrationIcon";
import { RideGForcePeaks } from "./RideGForce";
import { RidePeaksResetButton } from "./RidePeaksResetButton";

function StatisticValue({ value }: { value: string }) {
  return <dd>{value.split(/(\S+ (?:mi|mph|hr|min)\b)/).map((part, index) =>
    index % 2 ? <span key={index}>{part.split(" ")[0]} <small>{part.split(" ")[1]}</small></span> : part)}</dd>;
}

function elapsedTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = String(total % 60).padStart(2, "0");
  return minutes < 60 ? `${minutes}:${remainder}`
    : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${remainder}`;
}

export function RideStatistics({ ride, showAngles, live = false, calibrated = false, onResetAngles, resettingAngles = false, resetAnglesDisabled = false, resetAnglesError }: {
  ride: RecordedRide | null; showAngles: boolean; live?: boolean; calibrated?: boolean;
  onResetAngles?: () => void; resettingAngles?: boolean; resetAnglesDisabled?: boolean; resetAnglesError?: string;
}) {
  const motion = ride?.motion;
  return <>
    <dl className="ss-ride-statistics" aria-label="Ride statistics">
      <div><dt className={live ? "sr-only" : undefined}>Distance</dt><StatisticValue value={ride ? rideDistance(ride) : "— mi"} /></div>
      <div className={live ? "ss-ride-statistic-time" : undefined}><dt className={live ? "sr-only" : undefined}>Duration</dt><StatisticValue value={ride
        ? live ? elapsedTime(ride.durationSeconds) : rideDuration(ride.durationSeconds)
        : "—"} /></div>
      <div><dt>Top speed</dt><StatisticValue value={ride ? rideSpeed(ride) : "— mph"} /></div>
    </dl>
    {showAngles && <section className="ss-ride-summary-angles" aria-label="Peak angles">
      <div className="ss-ride-angles-heading">
        <h3>Peak angles</h3>
        {live && onResetAngles && <RidePeaksResetButton className="ss-ride-angles-reset"
          label="Reset peak angles" busy={resettingAngles}
          disabled={resetAnglesDisabled} onClick={onResetAngles} />}
      </div>
      {resetAnglesError && <p role="alert" className="ss-ride-error">{resetAnglesError}</p>}
      {live && !calibrated ? <p className="ss-ride-calibration-prompt">
        <span>Use <RideCalibrationIcon /><span className="sr-only">the calibration button</span> to measure peak angles</span>
      </p> : <dl className="ss-ride-statistics">
        <div><dt>Max lean left</dt><dd>{motion?.sampleCount ? `${Math.round(motion.maxLeftRollDegrees)}°` : "—°"}</dd></div>
        <div><dt>Max lean right</dt><dd>{motion?.sampleCount ? `${Math.round(motion.maxRightRollDegrees)}°` : "—°"}</dd></div>
        <div><dt>Max pitch</dt><dd>{motion?.sampleCount ? `${Math.round(motion.maxPitchDegrees)}°` : "—°"}</dd></div>
      </dl>}
    </section>}
    {!live && ride?.gForce && <section className="ss-ride-summary-gforce" aria-label="Peak G-force">
      <h3>Peak G-force</h3>
      <RideGForcePeaks summary={ride.gForce} />
    </section>}
  </>;
}
