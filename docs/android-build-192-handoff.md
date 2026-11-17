# Android handoff — source through build 193

Updated November 16, 2026. Continue using branch **`android/build-145`** so the
existing Android checkout can pull the latest source without changing branches.
This supersedes the [build 145/147 handoff](android-build-145-handoff.md).

The reference iPhone release is **1.0.3 (193)**, uploaded and submitted to Apple
on November 16, replacing build 192 with the expandable MPH view. Apple confirmed
Waiting for Review; release is manual. The prior phone review used 1.0.2 (192),
before the marketing version was advanced because 1.0.2 was already live. Build
193 has 211 verified packaged interface files and adds the speedometer change.
See [the release record](app-store-submission.md).

This branch saves the shared mobile source and the iPhone implementations for
the Android update. It is not an Android APK/AAB release, and native Android
ride recording, motion readings, and ongoing aircraft notifications still need
implementation and device testing.

## Shared changes to carry into Android

- The speedometer update submitted in iPhone build 193 lets the rider
  tap MPH to enlarge speed into the map circle, tap again to restore the map,
  and swipe to G-force. The rim follows aircraft status. Both orientations and
  active-recording continuity are covered by eight browser layout checks.
  See [speedometer behavior and verification](ride-speedometer.md).
- Updated Home, aircraft map, Ride Mode, settings, Help, Legal, and navigation.
  Ride Mode includes landscape layouts, a direction indicator that stays inside
  the map panel, and revised controls and transitions.
- Aircraft profiles resolve current-flight duration from takeoff or tracking
  timestamps. Map aircraft filtering and the shared display remain in sync.
- Twelve-hour time is the default; an explicitly saved 24-hour choice remains
  supported. Existing preferences and aircraft exclusions must survive updates.
- The saved ride interface supports ten recent summaries. The iPhone native
  store also retains ten; an Android recorder must implement the same capacity
  while preserving existing routes and lifetime statistics.
- The receiver and nationwide aircraft support from the earlier handoff remain
  included. Coverage and active aircraft vary. The source contains the existing
  v1/v2/v3 negotiation; this handoff does not deploy a backend format change.

## Memberships remain excluded from the release

Normal `npm run build:web`, `npm run sync`, and the Android signing helper all
build the interface with memberships disabled. The Vite configuration substitutes
the release modules in `mobile/frontend/release/`, strips held Help sections,
and rejects preview modules entering a release bundle.

The Android update must have no membership pop-ups, Pro/Elite tier labels,
Elite Settings, purchases, or rider-sharing interface. Direct Elite links return
to Settings. Existing maps, paths, alerts, and supported ride features remain
available without a membership requirement. A saved development plan must not
change that release behavior.

After rebuilding and syncing, both `mobile/www/bundle-info.json` and
`mobile/android/app/src/main/assets/public/bundle-info.json` must contain
`"membershipPreview": false`; `release-features.json` must agree. Do not use
`build:web:membership-preview` or `sync:ios:membership-preview` for store builds.

The original preview source remains available for future development. The
complete 470-file reference snapshot, manifest, and restoration notes are in
[`references/membership-preview-2026-11-16/`](../references/membership-preview-2026-11-16/README.md).
The archive SHA-256 is
`09c7c15a1044c30d521a07c773f80e8fda827b070a897b5aff6734256a506525`.
Extract it separately and merge selected changes; do not restore old shared
files over the fixes in this branch. See [membership notes](membership-preview.md).

## Native Android work still required

`mobile/android/app/src/main/java/live/outofsight/app/MainActivity.java` is
currently a plain Capacitor activity. `hasRideRecorder()` and
`hasNativeLiveTracking()` still select the iPhone bridges only. Copying the
shared screens does not provide Android recording, motion sampling, or a
background aircraft notification.

Use the following iPhone sources as behavior references when implementing
Android equivalents:

| Feature | Reference and behavior to preserve |
| --- | --- |
| Ride recording and history | `mobile/ios/App/App/RideRecorderPlugin.swift`, `SharedLocationService.swift`, and `mobile/ios/App/Shared/RideHistory.swift`: explicit start/end, location lifecycle, saved routes, ten recent rides, lifetime stats, and safe update/migration behavior. |
| Motion and calibration | `mobile/ios/App/Shared/RideMotion.swift` and its tests: calibrated lean/pitch and G-force, portrait/landscape handling, separate reset controls, and pause/resume behavior. Normalize Android sensor axes before using shared readings. |
| G-force compatibility | Preserve the outward-load convention: braking up, acceleration down, left turns right, right turns left. `maxLeftG`/`maxRightG` describe load direction. Keep the peak-confirmation behavior and migrate old unmarked summaries once to `lateralReference: "load"`. |
| Orientation and wake behavior | `ScreenAwakePlugin.swift`, `lib/device-ride-orientation.ts`, and `lib/device-screen-wake.ts`: implement an Android bridge before enabling its controls; unsupported devices should retain the current fallback. |
| Ongoing aircraft notification | `LiveTrackingPlugin.swift`, `RideTrackingData.swift`, and `LiveTrackingWidget.swift`: status at top left, nautical-mile distance at top right, aircraft details/update time at bottom left, and bearing arrow plus direction at bottom right. Use larger status text. The bearing points from the user toward the aircraft, independently of aircraft heading. |

For aircraft status, apply the same four-minute timeout as the map to each
aircraft's original `observed_at` observation. A newer fleet response must not
refresh an old aircraft's age. Support the older timestamp fallbacks in
`RideTrackingData.swift`; exclude unobserved, grounded, and expired contacts.
A healthy current feed with no tracked airborne aircraft can clear the previous
aircraft, distance, and direction without a new GPS fix. Distances to remaining
airborne contacts require current user location. An unavailable feed retains
the last result with its original timestamp; it must not invent a fresh Clear.

Keep ride recording and aircraft tracking independent: ending a ride must not
stop a manually started tracking session. Verify start/stop, lock screen,
background/resume, lost connection, landing/expiry, and permission behavior on
an Android device. iPhone Dynamic Island, CarPlay, and Watch layouts are iPhone
reference behavior, not Android implementations.

More detail: [G-force](ride-gforce.md), [motion](ride-motion.md),
[ride stats](ride-stats.md), and [Live Activity changes](carplay-live-activity.md).

## Build on the Android machine

Use the Capacitor project in **`mobile/android`**. The root `android/` directory
is the older Bubblewrap/TWA project.

From the existing checkout on `android/build-145`:

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
existing Play upload key; they are intentionally excluded from Git. Do not
replace an existing upload key. The Windows `npm run build:bundle` helper
rebuilds/syncs before signing and prompts locally for the key password.

`mobile/android/app/build.gradle` still contains **versionCode 7** and
**versionName 1.1.5**. Check the current Play release and set the next Android
code/name before uploading. Do not copy the iPhone build number or version
blindly. No Android version number, signing setup, Play listing, or production
release has been changed by this handoff.

The approved iPhone description is saved at
[`references/app-store-1.0.2-192/description-approved.txt`](../references/app-store-1.0.2-192/description-approved.txt).
It mentions recording, angles, G-force, and Lock Screen tracking. Use it as
reference for Android copy after those capabilities work on Android. The
iPhone release notes are not evidence of Android native feature parity.

## Validation and backend scope

The exact source selected for this handoff was exported into a clean folder,
without the Mac's private configuration or pending backend files. All **246
shared automated checks**, the mobile type check, the release interface build,
and **Capacitor Android sync** passed. All 209 generated web files copied
unchanged; Android adds two Capacitor compatibility scripts for 211 packaged
files. Shared runtime assets match the submitted iPhone interface, excluding
build manifests and generated compatibility files. Both membership flags are
false, and the packaged JavaScript has no membership prompts or Elite Settings.
Local handoff evidence is in `.local/android-handoff-192/` on the release Mac.
No Gradle build, Android installation, signing, or Play upload was performed.

The subsequent shared speedometer source in build 193 passed eight packaged
interface checks across Chromium/WebKit and portrait/landscape layouts, including
status rims and swiping from enlarged speed to G-force. The signed iPhone
distribution package matches all 211 tested interface files and still excludes
memberships. Evidence is in `.local/appstore-1.0.3-193/`. This update does not
change Android versioning or provide the missing Android native bridges.

Before the iPhone upload, twenty release screen checks passed across Chromium
and WebKit, along with the focused membership/access checks, mobile type
check, native tracking tests, signed package checks, and exact 211-file asset
comparison. The submitted binary excludes native billing and rider sharing.
These are iPhone/shared-interface checks, not Android installation or native
sensor tests. Local iPhone evidence is in `.local/appstore-1.0.3-192/` on the
release Mac; source, tests, and the membership reference archive are in Git.

Keep the production backend, ADSB.fi supplier, credentials, and schedules
unchanged. This branch update does not deploy functions or migrations. The
separate pending rider backend changes in the Mac working tree are outside
this Android source handoff; the saved preview archive remains reference only.
