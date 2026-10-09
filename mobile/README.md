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

The iPhone target is `ios/App/App.xcodeproj`, scheme **App**, display name
**Out Of Sight**, bundle ID `live.outofsight.app`, version 1.0, build 3, iOS 15+.
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

### Home Screen widget on iPhone — Status first

Build **1.0 (7)** includes the selected small **OOS Aircraft** Home Screen widget
in the existing WidgetKit extension alongside the Live Activity. The large
Stop/Warning/Watch/Clear label and dark background use red/amber/blue/green;
distance, Plane/Heli and tail number, selected state code, and original update
time appear below and around it. A healthy empty feed shows Clear with
"No aircraft airborne" and no invented aircraft or distance. Before the first
known result, it prompts the person to open OOS. `oos://home` opens Home.

The widget works independently of the Home Live control. Native preference
reconciliation saves the selected state, aircraft exclusions, and Ride bands
even when Live is off. With existing When In Use permission, opening OOS
requests a single current fix and aircraft snapshot. The widget declares
`NSWidgetWantsLocation` and obtains its own single fix when WidgetKit requests
a timeline. It requests another timeline after 15 minutes; iOS controls the
actual schedule. Live Tracking can also publish current results, with widget
reload requests limited to once a minute. No continuous background location
session is started for the Home Screen widget.

App and widget share `group.live.outofsight.app`. Their coordinated, atomically
written `Library/Application Support/OOSWidgets/home-widget.json` contains
preferences and the last known result, never rider coordinates. Coordinates
remain in memory, distances are calculated on-device, and requests send only
the selected state and cache timestamp. Missing/stale/failed data retains the
complete last known result and its original update time. Changed region,
exclusions, or bands invalidate results calculated with old preferences;
late requests cannot overwrite new preferences or newer observations.

To add it, open OOS once and allow location in Map if needed. Long-press an
empty Home Screen area, choose Edit → Add Widget, find Out Of Sight/OOS, and
add the small OOS Aircraft widget. Twenty tracking checks, seven widget-storage
checks, the mobile type check/interface build, signed device build, and local
App Store archive/export passed. Both exported targets have verified signatures,
distribution profiles, shared App Group, matching build 7, and debugging disabled;
production APNs and the bundled Radar sound were verified. On the physical
iPhone, shared preferences and a real aircraft result were verified. The owner
confirmed the state/distance/type/tail display and tapping the widget opens Home.
The pending Help contact edit was excluded from the packaged interface and
left untouched. No website deployment or App Store upload occurred.

The owner subsequently reported unexpected Live Activity termination while the
phone was locked. Build 8 addresses session recovery and background location;
the owner reports that it remains working with the phone locked (see below).

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

Build **1.0 (8)** addresses the owner's report of Live Activities disappearing
while the phone is locked. Launch previously ended every activity that did not
belong to the new in-memory session. The app now restores an ongoing activity
early in launch, including its preferences and last result. On iOS 17+ it holds a
`CLBackgroundActivitySession`, resuming it immediately after launch to retain
When In Use background eligibility. Location denial/restriction pauses updates
and retains the activity; a temporary activity-creation error keeps the pending
user-started session and retries in the foreground after 30 seconds.

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
`oos://home` opens Home from the activity. Legacy `oos://ride` links also open
Home. State, aircraft exclusions, and distance-band settings are reconciled
across all screens while a session is active.

Freshness limits: rider fix 30 seconds, feed 45 seconds, aircraft position 90
seconds. Missing, stale, mock, or failed source data cannot produce a new state.
Build **1.0 (5)** keeps the entire last known result when updates are unavailable:
Clear, Watch, Warning, or Stop, aircraft, distance, and the original Updated time.
ActivityKit's stale date no longer replaces that display with gray, Searching,
Updating, or Updates paused. A new session waits for its first known result
before creating the activity; the Home Live control can stop it while waiting.
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
