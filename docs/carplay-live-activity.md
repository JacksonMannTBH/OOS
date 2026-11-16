# CarPlay dashboard Live Activity

Prepared locally on November 16, 2026 for the next iPhone update.

OOS's existing aircraft Live Tracking session now provides a compact layout for
CarPlay Dashboard on iOS 26 and later. It shows the current proximity status in
red, yellow, blue, or green text, distance in nautical miles, compass direction,
aircraft type/tail label, and the original last-update time. The compact card
has no status dot or OOS label. The saffron warning uses the same color in both
appearances; other status colors darken for legibility in light appearance.
The last-update text sits beneath the aircraft label on the left. Direction
appears separately at bottom right, with an arrow pointing along its compass
bearing. Other text follows the system's light/dark appearance.
The primary readings and the lower information have a 12-point vertical gap.
It uses the same content and configured distance bands as the iPhone activity.

## Vehicle readability follow-up

The owner's November 16 vehicle photo (`IMG_0289.HEIC`) shows the existing card
in Dashboard, with its readings against the rounded edges. The earlier preview
provided 12 points of padding outside the native view, while the actual small
Live Activity had no inset. The small view now supplies its own 12-point horizontal
and 10-point vertical padding. Preview cards no longer add that missing spacing.

Status and compass direction use larger system text. The aircraft label and
update time are slightly larger, and the update time uses a stronger foreground
color. Status colors, distance precision and the approved arrangement are retained.
A compact header keeps the complete distance and unit visible when the main row
does not fit. Narrow cards can use a smaller compass label and omit the word
“Updated” while retaining the time below the aircraft; its accessibility label
still identifies the time as the last update.

Native before/after previews include the photo's 1750.2 nm reading at an approximate
232 × 104 point vehicle-card size. Sixty-four layout measurements cover eight
content cases, four widths, and two text sizes, with 128 dark/light renders.
The narrowest card, long readings, and enlarged text were also inspected visually.
Artifacts are `artifacts/carplay-live-activity/vehicle-card-comparison.png` and
`vehicle-card-dark-light.png`; local rendering records are in
`.local/vehicle-live-activity/`. The build 189 source snapshot confirms that its
device build already included this small-card revision. A fresh build 190 was
installed and launched on the phone after the owner's request to push the update.
The revised layout has not yet been rechecked in the vehicle.

Direction shows where the aircraft is from the user's current location using
N, NE, E, SE, S, SW, W, or NW, for example **↗ NE**. It is a true-north
compass bearing, independent of how the phone is held or which way the aircraft
is flying. The existing location readings supply both distance and direction;
there is no extra permission or location session. iPhone Lock Screen and expanded
Dynamic Island readings also include the direction.

## User flow

1. Enable Live Activities for OOS in iPhone Settings if they are disabled.
2. Open OOS and use **Start Live Tracking** on Home before driving.
3. Connect to CarPlay. The system can present the active session in Dashboard.
4. Use **Stop Live Tracking** on Home to end the session.

Starting or ending Ride Mode remains separate from aircraft Live Tracking.
CarPlay's Live Activity is read-only; starting/stopping and settings stay on the
phone. CarPlay controls placement, visibility, and alerts, including user
preferences and Focus. The app cannot guarantee a permanently pinned card.

## Implementation

- `mobile/ios/App/LiveTrackingWidget/LiveTrackingWidget.swift` declares
  `.supplementalActivityFamilies([.small])` on iOS 18 and later and selects the
  compact layout using `activityFamily`.
- That same small layout also supports the Apple Watch Smart Stack.
- iOS 16.2/17 keep the existing activity configuration. The iPhone Lock Screen
  and expanded Dynamic Island show status at top left, distance with `nm` at
  top right, and aircraft direction with a bearing arrow at bottom right.
  The previous OOS/region heading is removed. The Lock Screen retains the
  last-update time and aircraft label on the left.
- First use without a measured result shows Live tracking and an empty distance,
  without inventing a proximity status or an update time.
- An unavailable update retains the last result and its original timestamp, as
  in the existing tracking session. The card does not independently fetch data.
- With a healthy current feed, Live Tracking applies the map's four-minute
  timeout to each aircraft's original `observed_at` report. A newer fleet
  refresh cannot keep an old individual flight airborne. A confirmed landing
  or timeout clears the aircraft, distance, and direction, or selects the next
  available airborne aircraft. An empty sky can update without a fresh GPS fix;
  distances to remaining airborne contacts still require current rider location.
- The bearing is optional in saved activity content, so older results decode
  without a direction until a fresh measurement arrives. No direction is shown
  for an empty feed or coincident positions. Direction changes trigger an activity
  update even when the rounded distance remains the same.

This adds no CarPlay map or full CarPlay app. Apple supports Live Activities
without requiring a CarPlay app, so this feature does not request a CarPlay app
entitlement or change the existing location/session lifecycle.

## Validation and release status

The native simulator build passed with the existing iOS 16.2 widget deployment
target. Twenty-nine tracking checks, eight shared-storage checks, and ten recovery
checks passed. Direction coverage includes all compass sectors, user movement,
date-line crossings, undefined geometry, old saved results, and direction-only
changes at the same distance. Thirty-six compact-layout measurements passed across six content states,
three widths, and two text sizes. Native renders were inspected in light/dark
appearances and at the narrowest width with enlarged text. Status and distance
remain complete when the compact row needs to scale; long aircraft labels can
truncate. Samples cover all four known proximity statuses, no airborne aircraft,
and first use without a reading. Records are kept in the ignored
`.local/carplay-live-activity/` directory.

Actual CarPlay presentation, locked-phone/background updates, reconnection,
disabled Live Activities, and stopping the session still require an in-car or
CarPlay Simulator test. Static card renders do not verify those behaviors.
Signed development build **1.0.2 (187)** was installed over build 186 on Jackson's
iPhone on November 16, 2026. The app and widget both report build 187, and the
approved Live Activity source matches the tested layout. The packaged interface,
ten saved rides, lifetime statistics, and saved preferences were preserved.
The phone was locked during verification, so automatic launch was not performed.
Installation records and private data backups are in `.local/carplay-phone-187/`.
No TestFlight upload or public release was performed.

The subsequent iPhone notification layout revision was installed and launched
on Jackson's iPhone as signed development build **1.0.2 (188)** on November 16,
2026. The app and widget both report build 188. All ten saved rides, lifetime
statistics, saved preferences, and the 211 packaged interface files were preserved.
Installation records and private backups are in `.local/live-notification-phone-188/`.
The simulator app/widget build and all 29 tracking checks passed. Native layout
measurements cover eight content states, three card widths, and three text sizes,
including an accessibility size. Preview images and logs are in
`.local/live-notification-layout/`; these renders use sample readings.

Build **1.0.2 (189)** enlarges the iPhone Lock Screen status from 17 to 26 points
and the expanded Dynamic Island status from 17 to 22 points. The signed device
build and 72 native layout measurements passed, with the card staying below
160 points tall. Installed on Jackson's iPhone on November 16, 2026; all ten
saved rides, lifetime statistics, preferences, and packaged interface files were
preserved. The phone was locked, so the app was not launched automatically.
Records are in `.local/live-notification-phone-189/`.

Build **1.0.2 (190)** was installed over build 189 and launched on Jackson's
iPhone on November 16, 2026. The app and widget both report build 190. The small
vehicle layout matches the inspected native renders, and the complete native
source snapshot matches build 189, preserving its larger iPhone status text.
The signed device build passed. All ten saved rides, lifetime statistics,
saved preferences, and 211 packaged interface files were preserved. Installation
records and private backups are in `.local/carplay-vehicle-phone-190/`.
Live Tracking still uses the existing manual start flow; no automatic-start
behavior was added. This installation does not verify actual CarPlay rendering.

Build **1.0.2 (191)** fixes landing synchronization and was installed and launched
on Jackson's iPhone on November 16, 2026. The failure was reproduced from the
current Washington feed: N67817's individual report was over four minutes old,
but the native calculator rejected its coordinates and retained the previous
result instead of applying the map's landing timeout. Replaying that same feed
now produces Clear with no aircraft, distance, or bearing, with and without GPS.
The phone's shared result also updated to Clear after installation. The session
was subsequently stopped through the existing user-stop flow.

The signed device build, 34 native tracking checks, eight shared-storage checks,
ten recovery checks, and 13 map freshness/display checks passed. All ten saved
rides, lifetime statistics, preferences, and 211 packaged interface files were
preserved. Diagnostic captures and replay checks are in
`.local/live-notification-landing/`; installation records and private backups
are in `.local/live-notification-phone-191/`.

## Apple references

- [CarPlay developer overview](https://developer.apple.com/carplay/)
- [Turbocharge your app for CarPlay, WWDC25](https://developer.apple.com/videos/play/wwdc2025/216/)
- [Creating custom views for Live Activities](https://developer.apple.com/documentation/ActivityKit/creating-custom-views-for-live-activities)
