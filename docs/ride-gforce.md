# Ride G-force

Swipe the ride map to show G-force; swipe again for the map. Horizontal arrow
keys on the focused ride view provide the same navigation. The existing Stats
button opens Stats from either view and returns to the map. There is no G-force
button; swiping accesses G-force. Swiping
from Stats opens G-force. No navigation button is added.

The G-force circle uses the same shared responsive diameter as the ride map
(`min(100%, 310px, 38dvh)`). BRAKE sits at the top with peak braking below it;
ACCEL sits at the bottom with peak acceleration above it, and left/right peaks below L and R. L and R sit closer to the
outer edge, with their peaks below. The live dot remains, with no current numeric readout, heading,
separate peak list or swipe hint. Connection/calibration errors appear inside
the circle only while relevant. Saved summaries retain their peak rows; live
Stats has no G-force section.

Returning Home from G-force uses the same gentle shrink and fade as Stats,
while Home fades into place. The transition starts immediately without waiting
for Home's map. Reduced Motion opens Home directly, and ending a ride waits
until the transition finishes before showing the saved summary.

The native iPhone recorder reuses its 25 Hz Core Motion stream. Calibrate the
mounted phone upright and stationary at the start of each ride. Calibration
also serves Lean and Pitch when enabled, but G-force does not require angles
to be enabled. Turning angles off preserves G-force calibration and recording.
Each new ride requires calibration; navigating between screens preserves it.

`RideMotionTracker.gForce` uses gravity-free `userAcceleration`, already in G,
negates its inertial-force sign to obtain physical acceleration, and projects
it onto current horizontal forward and right axes. Gravity retains its original
sign for mounting calibration and leveling. See the sensor developer's
[coordinate reference](https://github.com/tszheichoi/awesome-sensor-logger/blob/main/COORDINATES.md#differences-between-ios-and-android).
Mounting
calibration uses the screen's horizontal intersection to account for combined
mount tilt and side cant, with the existing mount-axis fallback for a flat
screen. Current gravity levels the forward axis as the bike leans or pitches.
Forward/backward is unavailable when the bike points nearly vertically.
Directional accuracy assumes a portrait phone facing the rider and aligned
with the bike, as described in Settings.

Positive longitudinal G is acceleration; negative is braking. Positive lateral
G is rightward; negative is leftward. The live total is the magnitude of these
two horizontal components. It excludes gravity and vertical bumps and reads
approximately 0 G at rest. This is movement G, not total felt load.

Live sensor readings remain immediate. Each directional peak now records the
force sustained throughout a continuous 200 ms window, using the lowest value
in that direction across the window. A brief spike cannot raise the peak by
itself. Gaps longer than 100 ms, unavailable readings, backgrounding,
recalibration, and peak resets discard unfinished candidates. Confirmed peaks
remain saved; older ride summaries keep their existing values. This reduces
brief mount-vibration peaks without changing the G scale.

The dot moves up under braking and down under acceleration, matching the
labels. The visible dot eases toward the latest reading with a 200 ms time constant,
using elapsed time on each animation frame so response is consistent across
screen refresh rates. Scale changes ease with the dot; a smaller target scale
must remain appropriate for one second before shrinking, avoiding repeated
resizing around thresholds. Scale numbers are omitted, leaving that space blank.
Reduced Motion uses immediate dot updates. The plot unmounts and cancels its
animation when readings are absent or its view is hidden, so resuming starts
at the new reading. These display changes never feed back into stored peaks.

`gForceStatus` returns only the current reading and four peaks. The visible
meter requests it every 80 ms without overlapping requests; other views keep
the recorder's existing two-second status refresh. Native accumulation runs
across all views during an active foreground ride. The meter stops requesting
readings when hidden or paused and clears its dot when readings are absent.
Locking/backgrounding pauses the shared motion stream; GPS retains its existing
background behavior. Pausing and finishing flush pending peaks to disk.

`RecordedRide.gForce` is optional for archive compatibility. Calibration creates
the summary, preserving peaks on recalibration. Zero measured samples display
dashes; a measured zero displays `0.00 G`. Acceleration, braking, left and right
peaks are saved locally at most every two seconds and on pause/end, and appear
in the circle and completed ride summaries. Angle peak resets do not reset G-force.
Raw sensor streams are neither stored nor uploaded.

The refresh icon at the top right of the G-force view clears only the active
ride's four G-force peaks. It saves the reset before reporting success and keeps
mount calibration, the live dot, angle peaks, and ride statistics intact. New
samples begin accumulating immediately; new peaks still need 200 ms of continuous readings. The matching icon beside Peak angles
resets only angles. Neither control appears in saved ride summaries.

Validation: root and mobile TypeScript checks, packaged web build, simulator
build, existing RideMotion/RideHistory Swift suites, and the G-force suite:

```sh
swiftc mobile/ios/App/Shared/RideMotion.swift mobile/ios/App/Shared/RideHistory.swift \
  mobile/ios/Tests/RideGForceTests.swift -o /tmp/oos-gforce-tests
/tmp/oos-gforce-tests
node tests/visual/scripts/ride-motion.mjs
```

The UI fixture exercises swipe/keyboard navigation, animated dot coordinates,
scale easing and hold, unchanged peaks, Reduced Motion, pauses, compact layouts, summary persistence, and
G-force calibration with angles disabled. Synthetic tests cannot establish
accuracy during real riding; that requires a mounted physical iPhone.
