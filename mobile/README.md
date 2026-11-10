# Out Of Sight mobile apps (Capacitor)

This directory contains the Capacitor Android and iPhone projects. The existing Bubblewrap/TWA
project remains in `../android` as a recoverable fallback.

## Firebase setup required

1. In Firebase Console, add an Android app with package name
   `live.outofsight.app`.
2. Download `google-services.json`.
3. Save it locally as `mobile/android/app/google-services.json`. Never commit it
   or paste its contents into chat.
4. Deploy the `sendAircraftAlert` Firebase Function. It uses Google-managed
   runtime credentials, so no downloadable service-account key is required.
5. Store the shared `FCM_RELAY_SECRET` in Firebase Secret Manager and in
   Netlify's encrypted environment, and set Netlify's `FCM_RELAY_URL` to the
   deployed function URL. Never commit the relay secret.
6. Apply `supabase/migrations/20260907231758_add_native_push_transport.sql` to
   the production Supabase project, then deploy the updated website/backend.

## Local commands

Run these commands from this directory:

```powershell
npm install
npm run sync
npm run open
```

The app packages its own screens, Help, styles, and images. Only data and
notification requests use the production HTTPS backend. Native Capacitor plugins
handle Android permissions and Firebase notifications. Install root dependencies
with `npm ci` before installing dependencies here; the mobile build reuses shared
React components and assets from the parent project. After Firebase and
the backend environment are configured, run `npm run build:bundle`; it prompts
for the existing upload-key password without printing it and writes
`mobile/android/out-of-sight-capacitor-release.aab`.

## iPhone / Xcode

Release status (October 12, 2026): build **1.0 (11)** was uploaded, processed, and submitted
to Apple App Review. Its status is **Waiting for Review**. It packages the Washington/California scope, current
Settings, and updated privacy/support content. It uses `outofsight.live` data
services backed by the new OOS Supabase project. See
[`docs/app-store-submission.md`](../docs/app-store-submission.md) for the current
submission state, listing, published privacy answers, and validation limits.

The iPhone target is `ios/App/App.xcodeproj`, scheme **App**, display name
**Out Of Sight**, bundle ID `live.outofsight.app`, version 1.0, build 11, iOS 15+.
It uses Swift Package Manager, Capacitor 8.5.1, and Firebase Messaging 12.4.0.
The first release targets iPhone; iPad-specific layouts have not been validated.

From `mobile/`, with Node 22+ and Xcode installed:

```sh
npm ci
npm run sync:ios
npm run open:ios
# Build without an Apple signing identity:
npm run build:ios
```

Open Xcode, choose the **App** target, and select your Apple development team
under **Signing & Capabilities** when your paid membership is active. Automatic
signing and Push Notifications are already configured. Do not replace the
bundle identifier unless it also changes in Capacitor, Firebase, and App Store
Connect. Test with an iPhone simulator before selecting a physical device.

### iOS notification setup

Setup status updated October 9, 2026: **Out Of Sight iPhone** is registered in
Firebase project `out-of-sight-d3216` with bundle ID `live.outofsight.app`.
Its matching configuration is installed locally and ignored by Git. The live
subscription endpoint reports FCM relay configuration present; this does not
verify delivery by itself. On October 9 the owner uploaded the development
APNs key and confirmed that **Send test notification** arrived on the iPhone.
The owner also confirmed receipt while the iPhone was locked.
Apple enrollment is active per the owner's October 9 update. Xcode is now signed
in and an Apple Development signing identity is installed. Team `C6S63TAR8C` is configured for
both targets in Debug and Release. The signed development build is installed
and launched on the owner's iPhone; the owner confirmed Home loads normally.
The local App Store export also passed signing verification. The development
push delivery and locked-device receipt tests passed; foreground presentation
and background behavior while using another app,
notification taps, opt-out, and TestFlight production delivery still need testing.
The matching website changes were published on October 9, 2026 and the installed
app was relaunched. Actual automatic takeoff-alert triggering is not yet verified.
The `sendAircraftAlert` Firebase function update was deployed on October 9, 2026.
Both its existing Cloud Functions URL and Cloud Run URL respond, reject GET
with 405, and reject an unauthenticated POST with 401. These checks verify
routing and access control, not actual delivery to an iPhone.

October 9 notification-delivery repair: the Firebase relay secret contained a
trailing line ending, causing authenticated requests to return 401. Secret
version 2 stores the corrected value; the relay was redeployed with that version
and Netlify's production Functions secret was saved with the matching value.
The relay's runtime service account also lacked Firebase messaging permission;
it now has `roles/firebasecloudmessaging.admin` on this project. An authenticated
empty-body request now reaches validation (400), and a diagnostic request with
an intentionally invalid device token reaches FCM (`messaging/invalid-argument`).
These diagnostic probes targeted no real device. After completing development
APNs configuration, the owner confirmed successful test notification delivery
on October 9. The relay logged HTTP 200 responses at 18:18–18:19 UTC.
The owner subsequently confirmed successful receipt on the locked screen.

An Apple APNs key named **OOS Push Notifications** was created on October 9 for
team `C6S63TAR8C`: key ID `N9S6G4FN8F`, Team Scoped, **Sandbox & Production**.
The downloaded private key is stored outside the repository with owner-only
permissions. The in-app browser console cannot list apps despite verified owner
API access and an enabled Firebase Management API. The owner completed the
development upload in Safari and confirmed delivery. The same key supports
production, but its production upload was not independently verified; test
notification delivery again using a TestFlight build before release.

**Radar ping notification sound — October 9:** iPhone build **1.0 (4)** bundles
the selected original 1.25-second `oos_radar_ping.wav` as a main-app resource.
The deployed Firebase relay selects that file for iOS alerts and tests, and
`oos_radar_ping` / `aircraft_alerts_radar_v1` for Android. The Capacitor Android
app packages the same WAV in `res/raw`; channel creation runs before both first
enrollment and token refresh, including existing subscribers upgrading from the
old channel. Existing channels are not deleted. Android source is versionCode
7 / versionName 1.1.5; its native build remains unverified because Java is absent.
Eleven notification checks, both TypeScript checks, the relay build, mobile
interface build, signed device build/install/launch, and App Store archive/export
passed. Exported sound bytes match the preview, and both targets have matching
build 4, valid signatures/profiles, and disabled debugging; the app uses
production APNs. The packaged interface excludes the owner's unrelated pending
RadarMap edits. Actual playback of the custom tone awaits the owner's test.
No TestFlight/App Store upload or website deployment was performed for this change.

1. Add an **Apple/iOS app** to the existing Firebase project using
   `live.outofsight.app` (the Android registration is separate).
2. Download its `GoogleService-Info.plist` and place it at
   `mobile/ios/App/App/Configuration/GoogleService-Info.plist`. The Configuration
   folder is already included in the Xcode target. This file is ignored by Git.
3. After Apple membership activation, enable Push Notifications for the app ID
   and add the Apple APNs authentication key, key ID, and team ID to Firebase
   **Project settings → Cloud Messaging → Apple app configuration**. Keep the
   `.p8` key outside the repository and never paste it into chat.
4. Deploy the web changes and updated `sendAircraftAlert` Firebase function.
   This work does not automatically deploy either service.
5. Install on a physical iPhone, enable alerts in Settings, send a test, and
   verify foreground, background, locked-device, and notification-tap behavior.
   Turn alerts off and confirm delivery stops; re-enable and retest.

The app builds and launches without the Firebase plist for UI development.
Push delivery is unavailable until configuration/signing is complete.
`OOSNotificationSetup.status()` checks that the running iPhone app has initialized
Firebase with its own bundle ID before offering alerts. The web client combines
this with server readiness before a permission prompt or token registration;
older app builds lacking the check require an app update. Home does not display
an unavailable alert promotion. Automatic alert promotions appear only when delivery is
supported, configured, off, and not denied. The Home Screen install prompt is
browser-only and is suppressed in every native Capacitor app.
`AppDelegate.swift` explicitly maps APNs tokens to **FCM** tokens before passing
registration to Capacitor. The backend continues to use the existing `fcm`
transport. Messaging auto-initialization is disabled until registration is
requested. Permission prompts occur when users enable alerts or use location.
Map and Ride screen location watches stop when their owning screen unmounts.
The separate opt-in Live tracking session uses background location until stopped.

### Ride Mode on iPhone

`OOSBridgeViewController` registers the local `OOSScreenAwake` plugin. It uses
Apple's idle timer only while Ride Mode is foregrounded and the user has enabled
Wake mode. Independent leases prevent an old screen's delayed cleanup from
turning off a newer screen's lock. Leaving Ride Mode, loading a new document, or
backgrounding restores normal screen sleep. Browsers and Android retain the Web
Wake Lock fallback. No additional permission or paid Apple membership is needed
for this feature. Registration follows [Capacitor's custom iOS plugin guide](https://capacitorjs.com/docs/ios/custom-code);
the native behavior uses [UIApplication.isIdleTimerDisabled](https://developer.apple.com/documentation/uikit/uiapplication/isidletimerdisabled).

Missing compass headings stay unavailable; they are never converted to a north
reading. A valid GPS course remains the fallback when device heading is absent.

### Home Screen widget on iPhone — Start Ride

The small **OOS Ride** Home Screen widget displays the OOS eye logo at top left
and a yellow arrow at top right, above large, centered **Start Ride?** text in
the OOS dark-and-yellow style. Tapping anywhere opens
`oos://ride` directly in the packaged Ride Mode, both on a cold launch and when
OOS is already running. It opens the existing Ride screen; it does not enable
Live Tracking or bypass the screen's normal location setup.

The widget is a static launcher with no aircraft readings, location request,
network fetch, or periodic timeline refresh. It uses the existing widget kind
so existing placements receive the new design. OOS requests one timeline reload
per app launch to replace any cached aircraft-widget presentation. The widget
gallery name is now OOS Ride. Long-press an empty Home Screen area, choose
Edit → Add Widget, find OOS, and add the small OOS Ride widget.

Shared preferences remain available for recovery of older Live Activities;
the launcher does not read or display the stored aircraft snapshot. Native
preference reconciliation no longer performs a widget location/network refresh,
and Live Tracking no longer requests widget reloads for aircraft updates.
The separate Lock Screen/Dynamic Island Live Activity retains its tracking behavior.

Run widget-storage checks from `mobile/` with:

```sh
xcrun swiftc ios/App/Shared/RideTrackingData.swift ios/App/Shared/HomeWidgetStore.swift ios/Tests/HomeWidgetStoreTests.swift -o /tmp/oos-home-widget-tests
/tmp/oos-home-widget-tests
```

### Live tracking on iPhone

Home includes a small top-left **Live** button on native iOS 16.2+.
`OOSLiveTracking` starts an ActivityKit session and a Core Location watch from
the foreground. It uses When In Use authorization, background-location mode,
and the system location indicator. It never requests Always authorization.
The session survives navigating away from Home, ending Ride, or switching to another app.
Tapping **Live** again on Home stops location, polling, pending requests, and
removes the Live Activity. System ending or dismissal stops background work
without issuing a second immediate removal. An ended activity may remain visible
under iOS's retention policy. Relaunch recovers an existing active or stale
activity using saved settings; it never recreates an ended, dismissed, or
explicitly stopped activity.

Live startup now creates the activity synchronously while OOS is foregrounded,
before waiting for location or aircraft data. The initial **Starting…** display
has no aircraft distance or Updated timestamp. The Home Live control reports
active only after activity creation succeeds; creation failures are returned to
the control so the user can retry. The first valid result replaces Starting.
Later missing, stale, or failed updates retain the last known result and its
original timestamp and never switch it back to Starting. Relaunch also retains
an existing result rather than replacing it with the startup display.

Build **1.0 (8)** addresses the owner's report of Live Activities disappearing
while the phone is locked. Launch previously ended every activity that did not
belong to the new in-memory session. The app now restores an ongoing activity
early in launch, including its preferences and last result. On iOS 17+ it holds a
`CLBackgroundActivitySession`, resuming it immediately after launch to retain
When In Use background eligibility. Location denial/restriction pauses updates
and retains the activity. Build 8 originally retried activity creation in the
foreground after 30 seconds; the immediate startup flow above replaces that behavior.

A bounded local diagnostic log records lifecycle events, background session
eligibility, activity state changes, and stop reasons. It contains no rider
coordinates or push tokens and is not uploaded. Session and log files use
protection that permits access while locked after the first device unlock.
Both files are under the app's `Library/Application Support/OOSLiveTracking/`.
Nine recovery/persistence checks, twenty tracking checks, and seven widget
storage checks pass. Signed Release archive and App Store export also passed;
both targets have verified distribution profiles, signatures, App Group, matching
build 8, and debugging disabled. Production APNs and the original Radar sound
were verified. The signed debug build is installed on the owner's iPhone;
automatic launch was blocked because the phone was locked. After installation,
the owner reported that Live Tracking was still working in response to the
locked-phone test request on October 9, 2026. Exact elapsed time was not provided;
longer-duration behavior and restart recovery on the physical device remain
unverified. These fixes address definite automatic cleanup paths, but do not
establish the sole cause of the original locked-screen disappearance. iOS still controls
background runtime and Live Activity lifetime.

Run recovery checks from `mobile/` with:

```sh
xcrun swiftc ios/App/Shared/RideTrackingData.swift ios/App/Shared/LiveTrackingRecovery.swift ios/Tests/LiveTrackingRecoveryTests.swift -o /tmp/oos-live-recovery-tests
/tmp/oos-live-recovery-tests
```

The native session polls the existing HTTPS aircraft endpoint at most once per
15 seconds while iOS supplies background runtime. It sends the selected state
and a cache timestamp, with no rider coordinates. Distance and status are
computed locally using the selected aircraft exclusions and Ride thresholds.
The widget shows aircraft identification, nautical miles, and Stop/Warning/Watch/
Clear in the Lock Screen and expanded Dynamic Island. The compact presentation
shows state and distance; the minimal presentation uses the status color.
`oos://home` opens Home from the activity. `oos://ride` opens Ride Mode
from the Home Screen launcher. State, aircraft exclusions, and distance-band settings are reconciled
across all screens while a session is active.

Freshness limits: rider fix 30 seconds, feed 45 seconds, aircraft position 90
seconds. Missing, stale, mock, or failed source data cannot produce a new state.
Build **1.0 (5)** keeps the entire last known result when updates are unavailable:
Clear, Watch, Warning, or Stop, aircraft, distance, and the original Updated time.
ActivityKit's stale date no longer replaces that display with gray, Searching,
Updating, or Updates paused. Build 5 originally waited for the first known result
before creating the activity; the startup flow above now creates Starting immediately.
The Home Live control can stop it while waiting.
The Lock Screen background uses the distance-band color: green Clear, blue
Watch, amber Warning, and red Stop. Dynamic Island status, distance, icon, and
keyline use the same band color. The signed build installed and launched on the
owner's iPhone; color and stale-state display checks await the owner's test.
Fresh recovery replaces the retained result;
holding a result does not extend its freshness deadline. Runtime, connectivity, and delivery are not
guaranteed; Apple limits an activity to eight hours. Physical-device background,
Lock Screen, dismissal, deep-link, and permission testing remains required.
This local implementation does not need Firebase/APNs delivery credentials;
it updates ActivityKit on the device during the location session.

Build **1.0 (6)** adds `Plane` or `Heli` immediately before the tail number on
the Lock Screen and expanded Dynamic Island. Nicknames remain before the
typed tail, and unavailable updates retain the complete aircraft label.
The native feed decoder uses the fleet role (`patrol`/`sar` for helicopters,
`fixed_wing`/`transport` for planes), falling back to the existing aircraft-model
classification when the role is missing or unknown. Twenty native checks and
the signed device build passed; the build installed and launched on the owner's
iPhone. The release archive and local App Store export passed; both exported
targets have matching build 6, verified signatures and distribution profiles,
and debugging disabled. Production APNs and the bundled Radar sound were
verified. Label display awaits the owner's check. No App Store upload occurred.

Run the shared native calculation checks with:

```sh
xcrun swiftc ios/App/Shared/RideTrackingData.swift ios/Tests/LiveTrackingCoreTests.swift -o /tmp/oos-live-tracking-tests
/tmp/oos-live-tracking-tests
```

References: [ActivityKit](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities),
[background location](https://developer.apple.com/documentation/corelocation/cllocationmanager/allowsbackgroundlocationupdates).

### Home Live control and Ride display — October 9, 2026

Build **1.0 (3)** adds the compact Home Live button and the saved Show speedometer
setting under Ride mode & display. The speedometer defaults on, can be hidden
without affecting aircraft ground-speed information, and resets with device
preferences. Live tracking continues across navigation and End Ride. Stop it
from Home or dismiss the system activity. Reset preferences also stops tracking.
Activity taps return to Home; the native receiver accepts old Ride activity
links and routes them to Home too. Global preference synchronization updates
active tracking after state, aircraft exclusions, or distance bands change.

Radar, Ride, and flight-detail maps now start without a provider style and apply
our dark palette through MapLibre's style transform before the fetched style is
committed. Loading surfaces remain dark. This avoids displaying the provider's
light style while icons load; data, geometry, attribution, and provider resources
are preserved. Existing separate aircraft-opacity edits in RadarMap remain
outside this change's commit and are included in the local native build.

Verification: 112 automated checks, 14 native calculation checks, root/mobile
type checks, the Next.js production build, the packaged mobile build, signed
iPhone development build, installation, archive, and local App Store export
passed. App/widget signatures, Team/version/build, App Store profiles, production
APNs, disabled debugging, and packaged asset hashes were verified. The phone was
locked during automated launch. The owner then confirmed all requested device
checks passed: Map opens without the white flash, the Home Live button starts
and stops tracking, End Ride leaves it active, activity taps open Home, and the
speedometer switch hides/restores the MPH gauge and remembers the choice.
Android interface assets are synchronized as version code 6 / version 1.1.4;
its native release build still needs the Android tools and existing upload key.

These are bundled app changes. The source commit skips Netlify deployment;
the live website is unchanged. Before public app release, publish the revised
Help/privacy instructions to the support website. No App Store upload occurred.

### Bundled-interface validation — October 9, 2026

- Root and mobile TypeScript checks, the Next.js production build, the Vite
  interface build, and all 108 automated tests passed. Coverage includes local
  iOS/Android API URL mapping, alert POST preservation, notification tap safety,
  canonical sharing, and the new public-data query validation.
- The read-only data API shipped in commit
  `b90cb2e224bb1722ea8f0a678dc5f23b71a139b3`, Netlify deploy
  `6ac913425490440008952ef5`. Production smoke checks verified the catalog,
  forecasts/learning state, speed-warning setting, recent/specific-flight reads,
  rejected invalid requests, and missing-tail handling. The existing FCM backend
  reports configured; this does not verify APNs credentials or delivery.
- Both Capacitor projects were synchronized with the local interface. No hosted
  UI URL is present. The server-module build guard and a local credential scan
  passed. All packaged assets matched the built iPhone application and exported
  distribution package.
- The signed iPhone development build and installation passed. Automated launch
  was initially blocked by the locked phone. The owner then opened OOS and
  confirmed Home, Map, and Ride load normally, with Home and Help available in
  Airplane Mode. The signed Release archive and local App Store export passed for version
  **1.0/build 2**, replacing the earlier build-1 archive/export at the same local
  paths. App and widget signatures, team, matching versions, App Store profiles,
  production APNs, and disabled debugging were verified. No upload occurred.
- Existing separate edits to `components/RadarMap.tsx` were preserved outside
  the packaging commit; the local native builds include the current working-tree
  map. The owner confirmed the requested bundled-screen and offline checks.
  Notification delivery and Live Activity behavior still need device validation.
- Android sources/assets are synchronized as version code 5 / version 1.1.3.
  Native Android packaging was not run on this Mac: a Java runtime, Android SDK,
  and the existing Windows upload-key setup are not available here.

### Post-enrollment validation — October 9, 2026

- The unsigned Release iPhone build passed after Firebase configuration was added.
  It includes the matching Firebase project/bundle configuration, the embedded
  LiveTrackingWidget, matching version 1.0/build 1, and bundled SDK privacy manifests.
- Both targets use the owner's supplied Team ID `C6S63TAR8C` in Debug and Release.
- Archive preflight now checks matching target versions, production APNs
  entitlements, Firebase project identity, automatic signing, and a shared Team ID.
  Disposable fixture checks reject mismatched teams, build numbers, and development
  APNs settings in Release; the real configuration passes.
- Apple created the development certificate, and the owner's connected iPhone
  now has Developer Mode enabled. The first device build registered the iPhone
  and created a development provisioning profile for `live.outofsight.app`
  with the development APNs entitlement. The signed Debug build passed,
  installation and process launch succeeded, and the owner confirmed Home loads.
- The signed Release archive and local App Store export passed. The exported
  `ios/App/output/AppStore/App.ipa` passed strict signature verification for the
  app and embedded widget: Team `C6S63TAR8C`, version 1.0/build 1, App Store
  distribution profiles, debugging disabled, and production APNs entitlement
  on the app. Output files are ignored by Git. No TestFlight/App Store upload
  has occurred; push delivery and Live Activity behavior remain unverified.
- The owner approved publishing the prepared website changes. Commit
  `2463c10a1e47288fccd67ee90b7e791fa9e3d351` deployed successfully to
  `https://outofsight.live` as Netlify deploy `6ac90785d2d2e70008af2944`.
  Home, Ride, Help, and Legal returned HTTP 200; the removed `/api/spot` route
  returned 404. The published Ride client contains the Live Tracking button
  and native plugin integration. These checks do not verify rendered phone UI
  or Live Activity behavior. The app was relaunched for owner-led testing.
- The Firebase `sendAircraftAlert` update deployed successfully on October 9.
  The TypeScript predeploy build passed. APNs configuration and foreground,
  background, locked-phone, tap, and opt-out delivery tests remain pending.

### Pre-enrollment validation — October 8, 2026

- Automated checks: 103 tests passed, including native location cleanup,
  notification subscription ordering, iPhone notification readiness and old-build
  handling, alert promotion gating, compass validity, and screen-wake lifecycle.
- Live tracking: 14 shared native calculation checks passed for distance bands,
  nearest-aircraft selection, exclusions, source/position freshness, and app/widget
  content serialization. The app and embedded widget Debug simulator and unsigned
  Release iPhone builds passed; this does not verify signing or background behavior.
- TypeScript checking, the production web build, and the updated native Debug simulator build passed.
- An earlier simulator process launch was verified. The latest simulator install
  stalled even after a device restart and was cancelled; latest launch and rendered
  UI remain unverified. The device was not erased.
- Visual inspection remains pending: Device Hub access was not approved and the
  local browser-preview request was declined. Do not count these as passed tests.
- At that validation date, the changes were local and the native shell still loaded the live site. See the bundled-interface section for the current architecture.

Manual acceptance checks once preview/device access is available:

| Area | Expected behavior | Status |
| --- | --- | --- |
| Home and Settings | Content fits iPhone safe areas, large text remains usable, navigation works | Pending |
| Map / location denied | Map remains usable and explains unavailable location | Pending |
| Map / location allowed | Correct position; watch stops after leaving the screen | Pending |
| Ride / heading unavailable | No fabricated north reading; GPS course used only when valid | Pending |
| Ride / Wake mode off | Screen can sleep with Ride open | Pending |
| Ride / Wake mode on | Screen stays awake in Ride and sleeps normally after End Ride | Pending |
| Live tracking / start | One activity shows nearest aircraft, nm, selected state, and custom ride status | Pending on physical iPhone |
| Live tracking / other app and locked phone | Updates refresh; stale content keeps the last state, color, aircraft, distance, and timestamp | Pending on physical iPhone |
| Live tracking / stop on Home | Activity disappears and background location/polling stops | Pending on physical iPhone |
| Live tracking / End Ride | Ride exits and screen-wake stops; Live tracking remains active until stopped on Home | Pending on physical iPhone |
| Live tracking / system dismissal and relaunch | Recover an ongoing active/stale activity after restart; ended/dismissed or explicitly stopped activities do not restart tracking | Recovery policy checks pass; physical test pending |
| Live tracking / permission and tap | Denial is explained; activity tap reopens Home; settings changes reconcile | Pending on physical iPhone |
| Background / return | Location and wake behavior resume correctly without duplicate subscriptions | Pending |
| No connection / retry | Honest unavailable state, then recovery after connection returns | Pending |
| State and aircraft selection | Choices survive closing and reopening | Pending |
| Push alerts | Allow/deny, delivery, taps, token renewal, and opt-out | Requires Firebase/APNs setup |

App Store materials can be prepared before enrollment: final description,
support and privacy URLs, reviewer instructions, and screenshots from the tested
build. Keep screenshot capture and privacy answers pending until verified against
the configured app; the existing Android artwork is not an iPhone screenshot.
The [App Store submission draft](../docs/app-store-submission.md) contains listing
copy, reviewer notes, a screenshot plan, and the privacy questions still to resolve.

### Bundled interface and data service

Both Capacitor apps now load `www/index.html` from the installed app. There is
no `server.url`. Vite builds the shared public screens into local JavaScript,
CSS, Help content, and assets; lightweight adapters provide navigation, images,
lazy-loaded maps, and on-device display preferences without Next.js server code.
`npm run sync` builds and copies the interface to Android; `npm run sync:ios`
builds and copies it to iOS. `www/` and the copied native assets are generated
and ignored by Git. The older Bubblewrap/TWA fallback in `../android` still
opens the website and is not affected by this change.

App screen changes require a new app build and store update. Website deployment
alone no longer replaces the installed interface. The shared source still means
website and app changes can reuse components; deployment and distribution are
separate. Live aircraft data, map tiles, flight history, forecasts, and alerts
require internet access. Home, Help, and local display controls can open offline;
missing data must never be presented as fresh Clear status.

The app routes local `/api/` fetches to `https://outofsight.live` through native
CapacitorHttp. The new read-only `/api/mobile` endpoint exposes the public
catalog, flight details, forecasts/learning state, and speed-warning setting.
Existing aircraft, trail, location-state, and alert endpoints remain in use.
The server retains database access and secrets. A bundler guard rejects server
modules and database clients. Shared flight links use public HTTPS addresses;
notification taps and `oos://home` return to the packaged interface.

Preferences are stored on the device. Moving from the hosted origin to the
local app origin creates a separate preference store; recheck selected state,
aircraft exclusions, Ride thresholds, and notification enrollment after installing
this build. Existing HTTPS-origin settings are not automatically migrated.

For local work, run `npm run build:web` and `npm run typecheck` here, then sync
and build the relevant native target. Rebuild and sync after interface changes.
Keep the production API origin for device integration testing; never add a
remote UI URL to the release configuration.

### Durable aircraft and alert settings

Aircraft exclusions, selected state, notification identity, and alert opt-in use
`@capacitor/preferences` (UserDefaults on iOS, SharedPreferences on Android).
Startup restores them before mounting screens or syncing notification preferences.
The first launch migrates existing settings from the current origin's localStorage;
subsequent launches use the native snapshot even if the WebView store is cleared.
The previous hosted-origin migration limitation above still applies: already-lost
settings cannot be reconstructed from an empty local store.

Writes finish before the UI reports success. Failed reads block startup with a
retry screen instead of uploading default selections. Explicit preference resets
clear the native snapshot's entries as well as the web copy. Alert opt-in is
separate from an expired push registration; opted-in devices refresh it on launch
or foreground without another permission prompt. Explicit opt-out stays off.

This change requires a new native build (including the Preferences plugin and iOS
privacy manifest); deploying the website alone does not update TestFlight.

### Before TestFlight

```sh
npm run sync:ios
npm run check:ios:release
npm run archive:ios
# Prepare a local App Store package after the signed archive succeeds:
npm run export:ios
```

The release check verifies the packaged interface, native HTTPS transport, Firebase project and bundle ID,
app/widget version and build consistency, and production APNs entitlements.
The archive command additionally requires automatic signing and the same valid
Apple Team ID on both targets; it lets Xcode update provisioning with the
signed-in account. These checks do not verify APNs credentials or actual delivery.
Neither command uploads. Export uses `ios/ExportOptions.plist` for team
`C6S63TAR8C`, preserves the app/widget build number, and writes the distribution
package under the ignored `ios/App/output/AppStore/` directory. If the Apple
team changes, update both targets and this export configuration together.
In Xcode Organizer, validate the archive before distributing to App Store
Connect. Increment the build number for every subsequent upload and keep the
App and LiveTrackingWidget target versions/build numbers identical. Both targets
must use the same Apple development team for signing.

Remaining release checks: physical-iPhone location permission allow/deny and
recovery; maps and Ride Mode; Live tracking background, dismissal, and stale-data
behavior; state/aircraft selection persistence; launch with
no connection and retry; cold/warm notification taps and token renewal; support
and privacy links; app privacy answers covering opt-in background location, device IDs,
Firebase, hosting, and map providers; third-party data rights; screenshots and
review notes. Review the SDK privacy reports from the final archive. The app's
minimum-functionality review still needs to account for its hosted-web design.

References: [Capacitor iOS](https://capacitorjs.com/docs/ios),
[Capacitor push](https://capacitorjs.com/docs/apis/push-notifications),
[Firebase Apple messaging](https://firebase.google.com/docs/cloud-messaging/ios/get-started).


## TestFlight 1.0 (12) — October 18, 2026

Build 12 packages Texas and native persistence for aircraft selections, state,
and alert preferences, plus automatic recovery of opted-in alert registration.
The signed archive and upload succeeded, and Apple approved the TestFlight build.
The four existing testers are assigned; notification permission is pending.
All 141 automated tests passed, as did the native release check, iOS archive,
and Netlify production build. The matching live website API returns 343 aircraft
(WA 29, CA 230, TX 84). No public App Store submission or release was made.

Update through TestFlight without uninstalling so existing settings can migrate.
The daily-reset fix still needs overnight confirmation on a physical iPhone.
Release records are in `.local/release-1.0-12/` (ignored by Git).


## Retain the display quietly — October 19, 2026 (local changes)

Removed the delayed/stale-data banners and Ride Mode update-age warning.
Home and map retain the last known flight state; failed responses keep the prior
snapshot. Ride Mode keeps its previous contacts during a feed outage, scoped
to the selected state and aircraft, and uses retained positions when opened
during an outage. Successful responses replace the display, including landings.
Live-warning eligibility remains separate from these display-only contacts.

Validation: 26 focused status, tracking, ride, and freshness tests passed,
root/mobile type checks passed, and the mobile interface production build passed.
These changes have not been uploaded to TestFlight or deployed to the website.
Build 1.0 (12) and its pending tester notifications remain unchanged.


## Direct Supabase connection — next build (October 19, 2026)

The bundled interface, native Ride Mode, and Home Screen widget now call
Supabase directly through `oos-app`; Netlify is removed from their database
request path. All app routes are supported, including catalog/settings, aircraft,
flight paths/history, state lookup, and alert registration/preferences.
The existing random device ID and saved aircraft choices remain in use.

`backend.json` contains only the public endpoint and publishable key. The build
creates `Shared/AppBackend.swift` for both native targets, and release checks
reject mismatched configuration. Service-role and push-delivery secrets stay
server-side. The endpoint does not proxy requests through Netlify. The website
and older installed versions still use the existing website API. Automatic alert
delivery has also moved to Supabase; the next
build's data and alerts no longer require Netlify.

Validation: 145 automated tests, root/mobile type checks, mobile web build, and
generic iOS Simulator app + widget compilation passed. Supabase security advisors
reported no findings. Live read routes returned all 343 aircraft across WA/CA/TX.
The release backend check also requires Supabase native push credentials.
No new TestFlight upload or public App Store submission is part of this change.

Release gate: `archive:ios` runs the live read-only Supabase backend check before
archiving. Push credentials must be configured before it can pass.

Completed setup on October 19: Supabase and Firebase CLI sign-ins were renewed,
and the existing FCM relay URL/secret were copied securely into Supabase Edge
Function secrets. The relay accepted the credential and rejected an empty body
with HTTP 400 (no notification). `oos-app` now reports native alerts configured,
and the full live backend release check passes, including WA/CA/TX data, catalog,
history, forecasts, subscription status, unauthorized rejection, and CORS.
Actual delivery to a device was not exercised; no test notifications were sent.

The October 19 worker handoff preserves all existing native and browser push
subscriptions, including selected/excluded aircraft. Supabase now dispatches the
notification queue every minute, while aircraft collection stays at 30 seconds.
The live worker passed authenticated dry-run checks (including browser push
cryptography) and completed scheduled runs. Netlify's old schedules were removed.
The updated worker suite passes 148 tests. No additional native upload or tester
notification was made; see `../cloud-backend/README.md` for deployment details.

## Forecast removal — October 19, 2026

At the owner’s request, the forecast page, next-sweep prediction card,
probability grid, supporting calculations, mock forecast data, and mobile data
requests were removed. Supabase’s prediction worker, scheduler, and derived cache
were removed as well. The live API rejects both former prediction endpoints.
The app assets were rebuilt and synced to iOS; this change will be included in
the next TestFlight build. No new build has been uploaded or published.

## TestFlight 1.0 (13) — October 19, 2026

The signed release archive uploaded successfully and Apple shows build 13 as
**Testing**, assigned to all four existing testers. Automatically notify testers
was selected when submitting this build, as explicitly requested by the owner.
The update notes ask testers to update through TestFlight without uninstalling.
This build includes direct Supabase app/widget requests, retained last-known
aircraft displays, one-minute widget refresh requests (subject to iOS scheduling),
and complete forecast removal. Texas and durable aircraft/alert preferences
remain included. Release checks and the live backend checks passed; both app
and widget report version 1.0, build 13. No public App Store submission or release
was performed. Records and the confirmation screenshot are in
`.local/release-1.0-13/`.

## TestFlight 1.0 (14) — October 23, 2026

Build 14 uploaded successfully at 11:29 AM Pacific, completed processing,
and was last verified as Ready to Submit in App Store Connect. It includes the static Start Ride Home Screen widget with the
logo and arrow above the large title, a direct link into Ride Mode, and an
immediate Live Activity starting state that is not reused for stale data.
The root suite passed 140 tests; native tracking and recovery suites passed
22 and 9 tests respectively. Type checks, release checks, backend checks, and
the signed archive succeeded. Upload access was restored after the owner
accepted the membership assignment agreement for QWIKWRK LLC. TestFlight
notes are saved. Tester assignment is not yet confirmed because browser control
stopped responding during selection, before submission. No tester notifications
were sent. The existing public App Store submission remains version 1.0,
build 11, In Review; it was not changed. Release records are in
`.local/release-1.0-14/`.


## Live aircraft delivery — November 4, 2026

Build 35 uses a shared Supabase Realtime connection for live aircraft snapshots,
current-flight trails, and provider-health updates. The initial snapshot loads
once after joining, and reconnects recover current state. Healthy connections
no longer poll aircraft or trail endpoints. Notification permissions and the
existing takeoff notification system are unchanged. The website was not deployed.
See `../cloud-backend/README.md` for channel authorization and validation.

Signed build 35 uploaded successfully at 3:41 PM Pacific on November 4.
Apple processing was confirmed; tester availability has not yet been verified.
The archived interface matches the tested packaged assets. A browser offline/online
check verified that a reconnection reloads state and resumes pushed updates.
No public App Store submission was performed. Release records are in
`.local/release-1.0-35/`.


## Home loading during a feed outage — November 4, 2026

Home previously kept its loading screen visible when a completed aircraft
snapshot was stale and no fresh airborne aircraft remained. Home now opens
as soon as a snapshot is available, showing “Live data unavailable” instead
of “No Eyes” when its state cannot be resolved. If no snapshot arrives at all,
the initial loading screen ends after ten seconds, leaving settings, map,
and ride controls usable. Live updates continue to recover automatically.

Stale/fresh/blocked-connection browser checks passed, along with 13 targeted
freshness/cache/realtime checks and the mobile type check. The tested assets
match signed development build 59. The phone's previous build 58 and ride
history were backed up before the in-place installation. The website was
not deployed. Records are in `.local/loading-fix-59/`.


## Most recent state display — November 4, 2026

At the owner's request, build 60 removes the unavailable Home state and the
five-minute display expiry. Home, map markers, ride contacts, and active-session
trails keep the latest reported aircraft state until replaced. The read backend
returns saved observations regardless of age, so a restart uses the same latest
state. Internal provider health timestamps remain available to the workers;
source health no longer gates Home or discards a newer saved landing report.
A failed empty response preserves the previous result, and an older response
cannot replace a newer snapshot. The persistent cache stores the retained result.

The Supabase app API and ingestion broadcasts were updated; the website was not
deployed. Browser checks passed for an older airborne report, a newer landing
while the feed is unavailable, and reopening with no live connection. Unit checks
cover the matching retention/read/trail behavior. The tested packaged interface
is included in signed development build 60. Records are in `.local/latest-state-60/`.


## Four-minute no-report landing rule — November 4, 2026

The owner revised the display rule: four minutes without an aircraft's own
report displays that aircraft as landed. A newer fleet snapshot or reports from
other aircraft do not reset this deadline. Home remains usable; map/ride/Home
contacts clear the timed-out aircraft, and a new airborne report restores it.
The client applies the rule to cached snapshots as well as live updates.
Provider confirmation records are not fabricated by this display rule.

Build 61 includes this change. The targeted freshness/cache/ride/realtime suite
passes 25 checks; the mobile type check and packaged build passed. No backend,
supplier, schedule, or website deployment was made. Records are in
`.local/four-minute-61/`.


## Retain the displayed map while reconnecting — November 4, 2026

Build 62 holds the last rendered aircraft and eye state while the app is paused
and until a complete network update arrives after resuming. A separate per-state
display cache restores that exact rendered result when a screen is remounted;
a cache replay does not count as a completed refresh. Aircraft already shown as
landed before pausing stay landed. Original report times are preserved. Once a
network refresh finishes, the four-minute no-report rule applies normally.

The app listens to native pause/resume as well as document visibility changes.
It recreates a suspended transport on return and ignores callbacks from old
connections. Delivery remains shared by state; healthy connections do not poll.

Nineteen targeted display/cache/freshness/realtime checks, root/mobile type
checks, and browser pause/resume/delayed-refresh/remount checks passed. Signed
development build 62 includes the tested assets. No supplier, collection schedule,
backend deployment, or website changes were made for this update. Records are in
`.local/resume-display-62/`.
