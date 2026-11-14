# Ride lean and pitch (experimental)

The iPhone ride recorder can save estimated peak left roll, right roll, and
nose-up pitch locally with each ride. Settings → Ride mode & display has a
separate **Lean and Pitch** card immediately below **Speedometer**. Its summary
toggle defaults on and uses the native device preference store.

The card shows only “Track your maximum left/right lean and nose-up pitch.” beside its
toggle. An info button at the top right opens mounting, calibration, recording,
and measurement details. Ride summaries have no bottom explanatory note. Ride
mode shows calibration errors after an unsuccessful attempt. In the Stats view,
uncalibrated peak readings are replaced by **Calibrate your phone** until
calibration succeeds. Resetting peaks preserves calibration and does not restore
that prompt.

When enabled, Ride mode places **Calibrate** immediately to the right of Home. Mount
the phone rigidly in portrait, screen facing the rider and aligned with the bike.
Hold the bike upright and stationary on level ground, then tap Calibrate. The native
recorder requires fresh, steady motion readings before accepting calibration.
One tap arms calibration: the button blinks yellow while the client waits for
the steady-reading condition, without asking the rider to retry after movement.
Readiness is checked serially every 200 ms; native sensor acquisition stays at
25 Hz. Other failures end the attempt and show an error. Leaving Ride mode,
locking/backgrounding, disabling angles, or ending the ride cancels the wait.
Requests include the ride ID so a stale attempt cannot calibrate another ride.
The Lean and Pitch info popup has no border and explains both angles, mounting,
calibration, live Stats, resetting peaks, and when recording pauses.
In Ride mode’s Stats view, the refresh icon beside Peak angles clears the active ride’s
three peaks and pending samples while preserving calibration, distance, duration,
and top speed. New readings begin fresh peaks; saved ride summaries cannot be reset.
The reset is committed to local storage before success is reported.

An active ride is required. Each new ride needs calibration; navigating to Home
or Map during the same ride preserves it. Recalibration changes the reference
without deleting previously recorded peaks. Disabling angles stops angle
accumulation; reenabling requires angle calibration again. The shared sensor
stream and G-force mounting calibration continue independently. The calibration
control remains visible when angles are off. See `ride-gforce.md`.

Calibration accepts steep, flat, and side-canted starting poses; there is no
absolute starting-angle limit. It still relies on the portrait/aligned mounting
convention to label bike roll and pitch correctly. The phone's projected right
axis defines bike right. If that axis is nearly vertical, the projected top edge
defines forward instead, avoiding an undefined projection. Invalid gravity data
cannot replace an existing calibration.

Core Motion provides fused gravity at 25 Hz. Calibration constructs fixed bike
axes in phone coordinates to remove the mount's starting tilt. Projecting the
current vertical onto those axes separates roll from pitch without subtracting
Euler angles. Four consecutive readings (~120 ms) confirm a peak, using their
minimum magnitude so an isolated spike cannot create a record. Nonfinite data,
out-of-order timestamps, and stream gaps cannot establish peaks.

Pitch follows continuous rotation through vertical instead of using the standard
±90° Euler pitch range. A backward tilt can reach 180° at inversion and continue
through a full 360° turn. The tracker selects the continuous roll/pitch branch,
using body gyro rates to guide pitch through vertical. While the forward axis is
nearly vertical, gravity cannot determine roll, so its previous value is held.
Sideways inversion remains roll. Stream gaps, background pauses, and calibration
reset continuity; rotations performed while readings are absent are not inferred.

Only confirmed peaks and their count are stored, with no raw motion stream or
new network upload. Peaks are flushed at most every two seconds, when pausing
or disabling, and when ending a ride. Missing calibration or samples display
**—°** in saved summaries, distinct from a measured **0°**. Live Stats uses the
calibration prompt while uncalibrated and **—°** after clearing calibrated peaks.
Old ride archives still decode.

Angle acquisition pauses while the app is inactive or the phone is locked and
resumes when active, retaining calibration. GPS ride recording keeps its
existing background behavior. Slopes affect pitch; nose-up tilt does not by
itself establish a wheelie. Sustained cornering acceleration, vibration, mount
movement, and sensor fusion can bias the estimates. Accuracy during real riding
and permission behavior still require physical iPhone testing. Android and
browser ride recording are not supported by the existing native recorder.

## Validation

```sh
npm run typecheck
cd mobile && npm run typecheck && npm run build:web
```

From the repository root, native logic checks can run without a device:

```sh
mkdir -p .local/ride-motion
swiftc mobile/ios/App/Shared/RideMotion.swift mobile/ios/App/Shared/RideHistory.swift \
  mobile/ios/Tests/RideMotionTests.swift -o .local/ride-motion/motion-tests
.local/ride-motion/motion-tests
swiftc mobile/ios/App/Shared/RideMotion.swift mobile/ios/App/Shared/RideHistory.swift \
  mobile/ios/Tests/RideHistoryTests.swift -o .local/ride-motion/history-tests
.local/ride-motion/history-tests
```

With the packaged mobile preview served on port 4183 and Playwright available:

```sh
node tests/visual/scripts/ride-motion.mjs
```

The UI fixture covers opt-in persistence, separate Settings card placement,
calibration button placement, failed and successful calibration, navigation,
saved summary values, opt-out, new-ride calibration, and missing measurements.
Its simulated bridge cannot establish hardware accuracy.
