# Android handoff — source through phone build 220

Updated November 23, 2026. Continue using **`android/build-145`**. The existing
Android checkout can pull this branch without changing branches. This document
keeps its original filename so existing handoff links continue to work; it
supersedes the shared-source baseline through builds 192–194 and the
[145/147 handoff](android-build-145-handoff.md).

The latest tested phone baseline is **Out Of Sight 1.0.3 (220)**. The signed app
and widget were installed and launched on the owner's iPhone, with all ten saved
rides, lifetime statistics, and saved preferences preserved. This is a phone
installation record. The same source is now submitted as App Store version
**1.0.4 (220)**, with only app/widget version metadata changed; see the
[release record](app-store-submission.md). It is not an Android release.

This branch carries the shared screens and iPhone behavior references needed
for the Android update. Android recording, motion sensors, and ongoing aircraft
notifications still require native implementation and device testing. Android
source versioning remains **versionCode 7 / versionName 1.1.5**; select the next
Android version against the current Play Console release before signing.

## Changes since the previous handoff

- **Space Grotesk** is bundled throughout the app, map labels, offline page, and
  iPhone widget/Live Activity. Retain both
  `public/fonts/space-grotesk/SpaceGrotesk-Regular.ttf` and `OFL.txt`. No font
  download is required at runtime. The font uses SIL Open Font License 1.1.
- **Color Mode** appears above the 12/24-hour setting. Its row has the label on
  the left and current mode on the right; tapping opens the options. Color,
  Black & white, Red, Blue, and Green replace the original saffron accents.
  Red is `#e53935`, Blue is `#2f80ed`, and Green is `#1ed760`. Tinted maps use
  dull gray topography; the chosen accent colors the original accent areas,
  including roads, rather than recoloring every aircraft or map overlay.
- **Distance colors** has five palettes, independent of Color Mode. The final
  build 220 UI shows four swatches and a selection check per option, with no
  visible palette names or Clear/Watch/Warning/Stop captions in the popup.
  The closed Settings row also shows the selected swatches instead of a name.
  Accessible names remain available to screen readers. Colors are listed below
  for implementation; the distance thresholds and classification are unchanged.
- **Swipe gauge** offers G-force, Lean arc, and Moving horizon. Its menu shows
  instrument previews, descriptions, and the selected checkmark. Swiping the
  Ride map opens the selected instrument; another swipe returns to the map.
  Cancel/backdrop/Escape preserve the saved choice, and failed saves keep the
  previous choice visible. See [motion behavior](ride-motion.md).
- **Lean arc** displays immediate signed left/right lean with a fixed ±60° arc;
  only the needle position is clamped. It shares mount calibration and the
  confirmed peaks displayed in Stats. **Moving horizon** uses signed pitch,
  including negative readings and vertical/inverted poses, with a 68px pitch
  value and no “nose up” caption. Both live displays work when peak recording
  is switched off.
- **Live tracking colors** follow the distance palette, including existing
  sessions. The iPhone implementation applies them to the Lock Screen, Dynamic
  Island, and CarPlay. Its light CarPlay presentation darkens text to preserve
  contrast, including an additional adjustment for Electric's lime. Android
  needs equivalent readable presentation in its own ongoing notification.
- Help now includes CarPlay instructions, the gauge options, Color Mode, and
  distance palettes. CarPlay remains an iPhone feature; this does not add
  Android Auto support.
- The prior expandable MPH view, eye/slash transitions, portrait/landscape
  layouts, white distance rings, aircraft direction, ten recent ride summaries,
  saved routes, and lifetime statistics remain included. See
  [speedometer](ride-speedometer.md), [G-force](ride-gforce.md), and
  [ride stats](ride-stats.md).

### Distance palette contract

Use `lib/distance-color-palette.ts` as the shared source of truth. The internal
`danger` state is displayed as **Stop**. Preview and notification colors must
use the same ordering and values:

| Internal ID | Clear | Watch | Warning | Stop |
| --- | --- | --- | --- | --- |
| `classic` | `#39d98a` | `#60a5fa` | `#f6c431` | `#ff4d4f` |
| `ocean` | `#62d0ff` | `#9a9cff` | `#ffb454` | `#ff6080` |
| `sunset` | `#78d6ba` | `#f2cf66` | `#ff9654` | `#f76fa0` |
| `electric` | `#b6f35d` | `#3bd9ec` | `#ffd24a` | `#ff5353` |
| `frost` | `#a5d3d8` | `#96a8d6` | `#dfbd86` | `#e37a72` |

Persist `oos_distance_palette`, `oos_color_mode`, and `oos_ride_gauge` through
the existing native preference snapshot `oos_device_preferences_v1`.
`lib/device-preference-store.ts` includes all three keys. Missing/invalid shared
palette values default to Classic; the gauge defaults to G-force. An older
native snapshot must not import a stale browser-storage choice. Only publish
new choices after a successful durable save; a failed write keeps the previous
choice. Restore choices after web-storage loss and app restart, and preserve
other preferences, tracking exclusions, and device identity.

`lib/live-tracking.ts` forwards `colorMode` and `distancePalette` with state,
excluded aircraft, and distance thresholds. `LiveTrackingPreferenceSync`
reconciles display changes even when Home/Ride is unmounted. Treat palette
changes as display changes: update the existing notification without stopping
tracking, clearing a measured distance, or changing observation timestamps.

## Native Android work still required

`mobile/android/app/src/main/java/live/outofsight/app/MainActivity.java` remains
a plain Capacitor activity. `hasRideRecorder()` and `hasNativeLiveTracking()`
still select iPhone bridges only. Shared screens do not supply these native
Android capabilities. Implement and register the equivalents, then update the
platform checks only after they are available and tested:

| Feature | Reference and required behavior |
| --- | --- |
| Recording/history | `mobile/ios/App/App/RideRecorderPlugin.swift`, `SharedLocationService.swift`, and `mobile/ios/App/Shared/RideHistory.swift`: explicit start/end, location lifecycle, routes, ten summaries, lifetime stats, and safe migrations. |
| Motion/calibration | `mobile/ios/App/Shared/RideMotion.swift`, `mobile/ios/Tests/RideMotionTests.swift`, and `docs/ride-motion.md`: normalize Android sensor axes; preserve mounting calibration, confirmed peaks, independent resets, and pause/resume behavior. |
| Immediate gauge readings | Implement `OOSRideRecorder.leanStatus` as used by `lib/ride-recording.ts` and `lib/hooks/useRideLean.ts`, exposing signed `rollDegrees`, `pitchDegrees`, timestamp, calibration/receiving flags, and peaks. The iPhone reference withholds readings after 300 ms without a fresh sample. Ignore stale async results after pause/unmount; keep live angles available with peak recording off. |
| G-force compatibility | Braking up, acceleration down, left turns right, right turns left. Peaks describe load direction. Preserve peak confirmation and the one-time `lateralReference: "load"` migration for older summaries. |
| Orientation/wake | `ScreenAwakePlugin.swift`, `lib/device-ride-orientation.ts`, and `lib/device-screen-wake.ts`; retain the existing unsupported-device fallback until Android bridges work. |
| Ongoing aircraft notification | `LiveTrackingPlugin.swift`, `RideTrackingData.swift`, `HomeWidgetStore.swift`, and `LiveTrackingWidget.swift`: current state, distance in nautical miles, aircraft details, update time, direction from the user, and the selected distance palette. Persist/recover the latest measured result without making old readings fresh. |

Apply the map's four-minute timeout to each aircraft's original observation;
new fleet responses must not extend old aircraft reports. Preserve the older
timestamp fallbacks, exclusions, grounded/unobserved filtering, and nearest
located contact selection in `RideTrackingData.swift`. A healthy empty feed can
clear the aircraft without a new GPS fix. Other distance calculations need
current location. Unavailable data retains the last result and original update
time, without inventing a fresh Clear.

Recording and Live Tracking remain independent: ending a ride stops tracking
only when that ride started it. Test locking, background/resume, lost connection,
landing/expiry, permissions, calibration, and all three gauges on an Android
device. iPhone Live Activities, Dynamic Island, CarPlay, and Watch layouts are
reference behavior, not Android implementations.

## Build on the Android machine

Use **`mobile/android`**, the Capacitor project. The root `android/` folder is
the older Bubblewrap/TWA fallback. In the existing checkout:

```sh
git pull --ff-only origin android/build-145
npm ci
cd mobile
npm ci
npm run typecheck
npm run sync
npm run open
```

Retain the Android machine's Firebase `google-services.json`, SDK settings, and
existing Play upload key. These local files are excluded from Git. The Windows
`npm run build:bundle` helper rebuilds/syncs before signing and prompts locally
for the existing key password. It writes
`mobile/android/out-of-sight-capacitor-release.aab`.

Before packaging, set an Android version code greater than the last uploaded
Play build and choose its version name. Do not copy iPhone build 220 into the
Android version fields by assumption. The iOS project now declares **1.0.4 (220)**
for App Store packaging because 1.0.3 is already released. The reviewed phone
baseline remains 1.0.3 (220), with identical interface and native behavior;
only app/widget version metadata changed. No Android version, signing
configuration, Play listing, or production release is changed by this source
handoff.

## Membership and backend scope

Normal `npm run build:web`, `npm run sync`, and the Android signing helper keep
memberships disabled. Vite substitutes `mobile/frontend/release/`, strips held
Help sections, and rejects preview modules in the release. Both `bundle-info.json`
and `release-features.json` in the generated and Android-packaged assets must
contain `"membershipPreview": false`. Do not use membership-preview commands
for store builds.

Keep purchase dialogs, tier badges, Elite Settings, native billing, and rider
sharing excluded. The informational Settings NEWS banner stays available and
reopens after reading. Existing maps, paths, alerts, and supported ride features
remain available without a membership requirement. The saved
[membership source reference](../references/membership-preview-2026-11-16/README.md)
remains separate.

Keep the production backend, **ADSB.fi** supplier, credentials, and schedules
unchanged. This branch update deploys no functions or migrations. Pending rider
backend source, backend scripts/configuration, local diagnostics, private device
data, and unrelated store artwork on the Mac are outside this handoff.

## Validation record

Phone build 220 passed mobile type checking, the production web build, signed
app/widget verification, and installation/launch checks. Chromium and WebKit
checks cover the final five-option popup, twenty unchanged swatches, removed
visible names/captions, selected swatches in Settings, persistence, accessible
descriptions, and compact portrait/landscape layouts. Earlier palette checks
also verified all twenty status colors and contrast on dark/light notification
presentations. Phone evidence is local in `.local/distance-swatches-220/`.

The exact selected source was exported into a clean folder, excluding local
private configuration and pending backend work, and checked using the existing
installed dependencies. All **261 shared automated checks**, the mobile type
check, production interface build, and **Capacitor Android sync** passed. All
**212 generated web files** match their Android copies; Android adds two
Capacitor compatibility scripts for **214 packaged files**. Shared runtime
assets match the installed iPhone build 220, excluding generated build metadata,
and both membership flags remain false. The clean source also matches every
file in build 220's recorded source manifest.

The native motion and widget-storage reference tests also passed from this
export. Evidence is local in `.local/android-handoff-220/` on the release Mac.
Native Gradle packaging, Android installation, native sensor testing, signing,
and Play upload were not performed.
