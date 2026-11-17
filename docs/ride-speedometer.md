# Expandable Ride Mode speedometer

Tap the compact MPH readout to enlarge the current speed into the map circle.
Tap the enlarged readout to restore the map. The circular rim follows the
current aircraft status color: green Clear, blue Watch, yellow Warning, red
Danger. Speed and status continue updating while enlarged.

Swiping the enlarged readout opens G-force; swiping again restores the map.
The Stats control remains available. Switching views preserves the mounted map,
GPS session, and active recording. The existing speedometer display preference
also controls the expandable readout. Portrait and landscape are supported.

`tests/visual/scripts/ride-speedometer.mjs` exercises the packaged interface in
Chromium and WebKit at four phone sizes/orientations. It covers tap and keyboard
round trips, live speed changes and unavailable readings, status-colored rims,
G-force swipes, map and recording continuity, Stats, and Reduced Motion.
The isolated fixtures use sample GPS and aircraft data.

The feature is shared mobile source. Native Android recording and motion still
require the implementations described in the
[Android handoff](android-build-192-handoff.md).
