# Out Of Sight App Store release

## App Store 1.0.1 (97) — November 9, 2026

Build 97 replaces build 85 in the version 1.0.1 review submission. It includes
police sighting reports, first-use guidance, nearby Still Here / Not Seen voting,
and the owner's latest dialog edits. Signed archive/export and live backend
checks passed; the exported interface matches all 205 tested phone files.
Apple processed the upload without errors or warnings. Version 1.0.1 and its
new submission were both verified as Waiting for Review at 6:54 PM Pacific.
Automatic release after approval remains selected. Existing screenshots were
preserved, with release notes and reviewer instructions updated for the feature.
Records: `.local/release-1.0.1-97/release-record.json`.

## TestFlight build 1.0 (34) — October 27, 2026

Home retains its heading and visible aircraft during connection interruptions,
including after reopening the app. Ride mode has larger status text, a smaller
map placed higher, a flight estimate directly above aircraft information, and
vertically centered aircraft metrics. Development build 34 was installed and
launched directly on the owner's phone before the owner authorized TestFlight upload.

All 150 app tests passed, along with mobile type checking, packaged-interface
build, four ride status previews, and phone/tablet layout checks. The archive
matches all 202 tested interface files. Exported signatures, production APNs,
and matching app/widget build numbers passed. Apple accepted the upload at
12:24 PM Pacific. Apple processed and approved build 34 for TestFlight; status
is Testing. Owner Phone Testing and the four other existing individual testers
are assigned, covering all five testers. Test notes were saved and automatic
tester notification enabled.

[TestFlight build 34](https://appstoreconnect.apple.com/teams/afbc0f39-09ef-49b4-9029-e5ffd03729a4/apps/6821150916/testflight/ios/1b8aa9cf-33b0-48b5-8789-aaa506e20d7c).

No public App Store submission was made. Release records are in
`.local/release-1.0-34/`.

## TestFlight build 1.0 (31) — location lifecycle fix

Ordinary Home/map GPS watches now pause when OOS is hidden or receives a native
pause event and resume when it returns. Explicit ride recording and Live Tracking
remain controlled by their separate native sessions. This addresses the missing
UI watch cleanup found after the owner reported background location indication
with both controls showing Start. The owner installed TestFlight build 31 and
confirmed the location indicator clears outside OOS with both controls showing
Start. The owner also confirmed active ride recording and Live Tracking still
work while locked/backgrounded on build 31.

All 148 app tests, mobile type checking, packaged interface tests including
location lifecycle checks, archive/export and signed bundle validation passed.
Apple accepted the upload at 12:20 PM Pacific on October 26. TestFlight status is
Testing, assigned to the single owner tester through Owner Phone Testing. Testing
notes were saved and automatic owner notification enabled. No public App Store
submission was made.
Artifacts and test notes are in `.local/release-1.0-31/`.
The owner-approved description was saved to App Store Connect version 1.0,
English (U.S.), on October 26. Exact copy: `.local/release-1.0-31/description-approved.txt`.
This metadata save did not submit the app for review.

## TestFlight build 1.0 (30) — October 26, 2026

The owner authorized release preparation and TestFlight testing after confirming
background ride recording works on the development build. Version 1.0 (30)
archived, exported, and uploaded successfully at 11:50 AM Pacific. Apple processed
and approved it for TestFlight; status is Testing. Only the owner's existing
Jackson Mann tester account was assigned and notified. Test notes are saved.

[TestFlight build 30](https://appstoreconnect.apple.com/teams/afbc0f39-09ef-49b4-9029-e5ffd03729a4/apps/6821150916/testflight/ios/7d9272c7-9763-4912-8f5c-b32a117a0841).

All 143 app tests and 52 native ride/tracking/recovery/widget checks passed,
as did packaged-interface browser tests, mobile type checking, backend checks,
and release validation. The exported app and widget have matching build numbers,
valid distribution signatures, and production APNs entitlements on the app.
Exported interface assets match the tested bundle. The owner installed TestFlight build 30 and confirmed Send test notification
arrives on the physical phone, verifying production push delivery.

Native iPad verification passed on the iPad Air 11-inch (M3) simulator running
27.0. Home was checked in portrait and landscape with three saved-ride fixtures;
Start Ride and View Map remained reachable after a swipe. View Map opened and
the ride confirmation opened/cancelled. Screenshots and the passing XCTest result
are saved with the release artifacts. Apple's reported 27.2 was not available.

The owner still saw build 13 in TestFlight after refreshing and opening the email
invitation. A dedicated external group, Owner Phone Testing, now contains only
build 30 and the owner's existing phone tester account. No public link was enabled.
The owner confirmed build 30 became available after this group assignment.
The owner subsequently installed build 30 and confirmed the test notification arrives.

The owner is preparing the demonstration recording and screenshots. A concise
App Store description draft is saved in
`.local/release-1.0-30/description-draft.txt`; it has not been published.
The public App Store resubmission remains pending. No website or backend changes
were deployed. Release artifacts and logs are in `.local/release-1.0-30/`.

## TestFlight build 1.0 (12) — October 18, 2026

The owner requested a new TestFlight build and explicitly prohibited public
App Store publication. Build 12 includes Texas (84 aircraft; 343 across WA/CA/TX),
native persistence for aircraft selections and state/alert preferences, and
alert-registration recovery. All 141 automated tests passed.

The signed archive and upload succeeded at 11:39 AM PDT. App Store Connect
processed and approved build 12 for TestFlight; the same four existing individual
testers are assigned. Testing notes are saved. Automatic notifications were left
off, and the final Notify Testers action is pending owner permission to send.

Build ID: `7b271dae-5d92-4b80-b557-b6a54cd4146c`.
[TestFlight build 12](https://appstoreconnect.apple.com/teams/afbc0f39-09ef-49b4-9029-e5ffd03729a4/apps/6821150916/testflight/ios/7b271dae-5d92-4b80-b557-b6a54cd4146c).

Netlify production deploy `6ad5133481b34cfde8049ca6` is live. Production checks
returned 343 mobile catalog entries (WA 29, CA 230, TX 84) and a healthy Texas
aircraft endpoint with 84 entries. The database and collector already include
Texas. No new public App Review submission or App Store release was made.
Historical App Store metadata below remains unchanged. A future Git-based
website deploy must retain these source changes to preserve Texas support.

## Current release — October 12, 2026

Version **1.0 (11)** was successfully **submitted to Apple App Review** on
October 12, 2026 at 11:59 AM PDT. Apple confirmed “1 Item Submitted”; the
submission detail status is **Waiting for Review**.
This is not yet an approved or public release.

Submission ID: `230cce38-a202-4737-84a5-6935b3ab6a65`.
[App Review submission](https://appstoreconnect.apple.com/apps/6821150916/distribution/reviewsubmissions/details/230cce38-a202-4737-84a5-6935b3ab6a65).

The owner approved a **free, United States-only iPhone launch**, with automatic
release after Apple approval. Mac and Apple Vision Pro distribution are disabled.
The app uses the new OOS backend and offers Washington and California only.
The catalog contains tracked public-safety aircraft, not every aircraft physically
within those states.

| Field | Saved value |
| --- | --- |
| Name | Out Of Sight: Aircraft Tracker |
| Subtitle | Public safety aircraft tracker |
| Apple ID | 6821150916 |
| Bundle ID | live.outofsight.app |
| Version / build | 1.0 / 11 |
| SKU | oos-iphone-001 |
| Category / age rating | Reference / 4+ |
| Language | English (U.S.) |
| Copyright | 2026 Jackson Mann |
| Price / availability | Free / United States |
| Release | Automatically after App Review |
| Support URL | https://outofsight.live/help |
| Privacy URL | https://outofsight.live/legal#privacy |
| Marketing URL | https://outofsight.live |

### Promotional text

Explore public-safety aircraft by state, view available flight paths, and keep nearby aircraft information handy with Live Tracking and a Home Screen widget.

### Keywords

aviation,helicopter,plane,flight,radar,ADS-B,police,emergency,map,tracking

### Description

Explore law-enforcement and public-safety aircraft activity in Washington and California with Out Of Sight.

Choose Washington or California to focus the map and tracked aircraft list. Browse aircraft profiles, see available positions and flight paths, and adjust which aircraft appear in your view.

Ride Mode shows nearby aircraft distance and direction, with an optional speedometer. Customize distance bands, time format, contrast, and screen-wake behavior in Settings.

Start optional Live Tracking from Home to see the nearest tracked aircraft, distance, and Clear, Watch, Warning, or Stop on your Lock Screen and supported Dynamic Island. Add the OOS Aircraft Home Screen widget for a quick view of the latest available result. When new data is unavailable, these displays retain their last result and original update time.

Aircraft data comes from public observations. Coverage and freshness vary, and an aircraft may be missing or its position delayed. An internet connection is required for live information. Location permission is optional and is used for features that depend on your position.

Out Of Sight is an independent project and is not affiliated with a government agency or aircraft operator. It is for informational use, not navigation, emergency response, or collision avoidance. Use the app only when it is safe to do so.

### Reviewer notes

No sign-in is required. Open Home, then Map to view available aircraft. Select Washington or California in Settings > Notifications & state. Settings also contains the aircraft catalog, display preferences, Help, and Legal & privacy.

Aircraft observations depend on third-party coverage and real flight activity; a state may have no currently airborne aircraft. The catalog remains available to browse. This app is informational and does not provide navigation or collision avoidance.

Location permission is optional. Map and Ride Mode use it for position, distance, and speed on the device. The map may send one location fix through our server to the US Census geocoder to choose the initial state; map tile requests also reveal the viewed area to the tile provider. Ride Mode has optional screen-wake and MPH speedometer controls.

On iOS 16.2+, the small Live button on Home starts and stops Live Tracking. Background location is used only during this user-started session to calculate aircraft distances locally while the phone is locked or another app is open. Always authorization is not requested. End Ride does not stop Live Tracking; tap Live on Home to stop it. The Live Activity shows aircraft type and tail, distance in nautical miles, and the user's distance-band status. Tap it to reopen Home. Unavailable or expired observations retain the last result and original timestamp rather than implying a fresh Clear state.

The small OOS Aircraft Home Screen widget works independently of Live Tracking and opens Home when tapped. iOS controls its refresh schedule; missing data retains its last known result.

The app packages its interface and Help locally. Aircraft data, map tiles, flight history, and alerts require internet. Home and Help can open offline. The app has no purchases or checkout.

### Published privacy disclosures

The owner explicitly approved Apple's privacy confirmation. Disclosures are
published, with no advertising tracking:

| Data | Purposes | Linked |
| --- | --- | --- |
| Precise location | App functionality | Yes, conservatively accounting for provider request logs |
| Device ID | App functionality | Yes |
| Product interaction | App functionality and product personalization | Yes |
| Other diagnostic data | Analytics and app functionality | Yes |
| Other data types | Analytics (anonymous Firebase metadata) | No |

Location calculations for Ride/Live Tracking occur on the device. The initial
map state lookup can send one location fix through our server to the US Census
geocoder, and tile requests reveal the viewed map area. Notification identifiers,
preferences, and delivery diagnostics are stored by online services. Firebase
SDK manifests and partner privacy policies were reviewed. Public Help and Legal
were updated; the live privacy page includes the location lookup, SDK metadata,
and Home Screen widget. Website commit:
`a448a937336fa93da3aa661b36bf2711792d4e88`.

### Validation and artifacts

- Mobile type check and web build passed; Capacitor assets synchronized.
- Nine recovery, twenty tracking, and seven widget-storage tests passed.
- Build 11 signed archive and App Store upload succeeded; both app and widget
  have matching version/build and verified signatures.
- Build 11 simulator build and installation passed; Home → Settings → catalog
  UI checks passed on iPhone 18 Pro and Pro Max simulators. One exploratory
  capture failed due to an incorrect “Tracked Aircraft” test label; correcting
  it to the actual “Tracked Aircrafts” label passed without app changes.
- Uploaded two medium iPhone screenshots (Home and Washington catalog) and four
  large iPhone screenshots (Home, catalog, map, Settings). Captures use actual
  app screens and real observations, with location permission denied. Large
  Home/map captures use the identical interface from build 10; medium captures
  and large catalog/Settings use build 11. Loading/unfinished captures were
  excluded. Apple accepted the dimensions and final submission validation.
- No non-exempt encryption is declared; HTTPS uses operating-system encryption.
- Release artifacts are kept locally under `.local/release-1.0-11/` (ignored).
- Prior physical-device Live Tracking, widget, and development push checks are
  documented below. Production TestFlight notification delivery has not been
  independently verified; no claim of a completed production push test is made.

## Organization conversion request — October 12, 2026

At the owner's explicit request, submitted Apple's Individual to Organization
Membership Update for **QWIKWRK LLC**, United States, D-U-N-S **148645084**.
The request asks for public developer name **QwikWrk** and seller name
**QWIKWRK LLC** for the existing app and team. Owner supplied founder status,
no separate company membership, no Tax ID associated with the current individual
membership, and no known DBA/trade name.

Apple confirmed receipt: “Thanks for contacting us” and stated it would review
the request and respond within one business day. The conversion and public name
change are **pending Apple's verification and approval**, not completed. The
owner explicitly chose to keep automatic app release enabled while this request
is processed. Confirmation screenshot is stored locally at
`.local/release-1.0-11/qwikwrk-conversion-submitted.png`.

## Historical release findings

The entries below describe earlier packages and their state at the time. The
current release section above supersedes earlier statements that no upload or
website deployment occurred.

- The website changes were published on October 9, 2026 in commit
  `2463c10a1e47288fccd67ee90b7e791fa9e3d351`, Netlify deploy
  `6ac90785d2d2e70008af2944`. The client now supports native iPhone push and
  suppresses the Home Screen install banner inside iOS. Alert controls check
  iPhone build readiness as well as server
  readiness, and automatic promotions are suppressed when alerts cannot be
  enabled. The signed app includes the notification-readiness plugin, and the
  Firebase relay update was deployed on October 9. Development test push
  delivery is now confirmed by the owner; production delivery remains untested.
  This setup is separate from the Live tracking location session.
- October 9 notification repair: corrected the relay secret's trailing line
  ending, deployed Firebase secret version 2, saved the matching Netlify
  production Functions value, and granted the relay runtime account the Firebase
  messaging role. Authenticated requests now reach validation and FCM. Invalid
  diagnostic tokens were used initially. After the development APNs upload,
  the owner confirmed that Send test notification arrived on the physical iPhone.
  The relay logged HTTP 200 responses at 18:18–18:19 UTC on October 9.
  The owner also confirmed notification receipt while the iPhone was locked.
- Apple APNs key `N9S6G4FN8F` (**OOS Push Notifications**) was created for team
  `C6S63TAR8C`, with Sandbox & Production access. Its private key is secured
  outside Git. The owner reported uploading the development credential in
  Safari, then confirmed delivery. Production upload has not been independently
  verified; TestFlight delivery, foreground presentation, background behavior
  while using another app, notification
  taps, opt-out, and automatic takeoff-alert triggering still require checks.
- The local Help page now has a support contact, separate native and browser
  notification instructions, and a location summary covering on-device use and map requests.
  Both public Help and Legal URLs returned HTTP 200 on October 9, 2026. The
  published Help page includes the contact link and Live Tracking instructions.
- Listing text is within the current limits: name 12 characters, subtitle 30,
  promotional text 131, description 1015, and keywords 74 UTF-8 bytes. The icon
  is 1024 by 1024 pixels without an alpha channel. The matching iPhone Firebase
  configuration was installed on October 8, 2026; the local release configuration
  check now passes. The development APNs key upload and test delivery are now
  confirmed by the owner. Apple
  enrollment is now active per the owner's October 9 update; Xcode is signed in
  and the Apple Development certificate is installed. Team `C6S63TAR8C` is configured on
  both targets for Debug and Release. The unsigned Release build passed. The owner's
  iPhone now has Developer Mode enabled. The signed development build is installed
  and launched, and the owner confirmed Home loads normally. The signed Release
  archive and local App Store export passed. Both exported targets have verified
  signatures and App Store profiles, matching Team/version/build, and debugging
  disabled; the app has the production APNs entitlement. No upload has occurred.
  The Firebase relay update deployed successfully; its existing URL and Cloud
  Run URL reject unauthenticated requests. The physical-iPhone test notification
  passed; the remaining release checks are listed above.
- Latest local package: **1.0 (8)**. Addresses unexpected Live Activity
  disappearance reported while the phone is locked. Recovers an existing
  active/stale activity on launch instead of ending it, holds and resumes a
  dedicated background location session on iOS 17+, and retains the last result
  during location-permission interruptions. Only explicit Stop requests immediate
  removal; system ending/dismissal releases background work without overriding
  iOS display retention. Ended, dismissed, and explicitly stopped sessions are
  never silently recreated. A bounded local lifecycle/reason log contains no
  rider coordinates or push tokens and is not uploaded. Nine recovery tests,
  twenty tracking tests, seven widget-storage tests, release configuration checks,
  and the signed device build/install passed. Release archive and App Store
  export passed; both targets have verified signatures, distribution profiles,
  App Group, matching build 8, and debugging disabled. Production APNs and the
  original Radar sound were verified. Automatic launch was blocked by the
  locked phone. The owner subsequently reported that Live Tracking was still
  working in response to the locked-phone test request on October 9, 2026.
  Exact elapsed time was not provided; longer-duration behavior and physical
  restart recovery remain unverified. The fixes do not prove the sole cause of
  the original report. No website deployment or App Store upload occurred.
- Prior package: **1.0 (7)**. Adds the selected small Status first
  Home Screen widget, independent of Live Tracking. It shows the large colored
  ride state, aircraft distance, Plane/Heli and tail, selected state code, and
  original update time. App and widget share preferences and last results in
  `group.live.outofsight.app`; no rider coordinates are stored there or sent
  with aircraft requests. iOS schedules timeline refreshes; unavailable data
  retains the last result. The bundled privacy text describes this feature.
  Twenty tracking checks, seven widget-storage checks, mobile type check/build,
  signed device build/install/launch, and App Store archive/export passed.
  Both exported targets have matching build 7, verified signatures/profiles and
  App Group, and debugging disabled. Production APNs and Radar sound were
  verified. Shared preferences and a real aircraft result were verified on the
  phone; the owner confirmed widget display and tapping it opens Home.
  The pending Help contact edit remains untouched and excluded from this bundle.
  Publish updated public privacy/support content before release. The earlier
  reported unexpected Live Activity termination still needs diagnosis. No
  website deployment or App Store upload occurred.
- The prior package **1.0 (6)** added Live Activity aircraft labels that include
  `Plane` or `Heli` immediately before the tail number on the Lock Screen and
  expanded Dynamic Island. Nicknames, distance-band colors, and last-known
  state retention are preserved. Twenty native checks and the signed device
  build passed. The build installed and launched on the owner's iPhone; label
  display awaits the owner's check. Release archive/export passed; both exported
  targets have matching build 6, verified signatures and distribution profiles,
  and debugging disabled. Production APNs and the bundled Radar sound were
  verified. No App Store upload occurred.
- The prior package **1.0 (5)** added Live Activity Lock Screen backgrounds that
  follow the distance-band color: green Clear, blue Watch, amber Warning, red
  Stop. Dynamic Island status, distance, icon, and keyline share the band color.
  Stale or failed updates preserve the complete last known result and its
  timestamp; fresh data replaces it. A new session creates the activity only
  after a known result, while the Home Live control can stop pending tracking.
  Nineteen native calculation/retention checks, the signed device build, and
  archive/export passed. App/widget build 5, signatures/profiles, production
  APNs, and disabled debugging were verified. The signed development build
  installed and launched on the owner's iPhone after reconnecting. Physical display testing
  remains pending. The bundled Help explains retained state; publish the updated
  support content before release. No App Store upload occurred.
- The prior package **1.0 (4)** bundles the selected original 1.25-second Radar ping
  is bundled in the iPhone app and selected by the deployed Firebase push relay
  for tests and aircraft alerts. The signed build installed and launched on the
  owner's iPhone. Eleven notification checks, type checks, mobile interface build,
  relay build/deployment, and signed archive/export passed. Exported sound bytes,
  app/widget versions, signatures/profiles, production APNs, and disabled debugging
  were verified. Custom sound playback awaits the owner's test. Android source
  includes the same sound and a new channel for upgrades; Java is unavailable,
  so native Android sound playback is unverified. No App Store upload occurred.
- The prior local package **1.0 (3)** added the compact
  Home Live button, persists after End Ride, and its activity tap opens Home.
  Ride display settings include a saved Show speedometer switch. Map styles are
  transformed dark before commitment to prevent the light startup frame.
  112 automated checks, 14 native calculation checks, type checks, web/mobile
  builds, signed device build/install, and App Store archive/export passed.
  Exported app/widget signatures, profiles, production APNs, matching version,
  and disabled debugging were verified. The launch attempt was blocked by the
  locked phone; the owner subsequently confirmed the dark map startup, Home Live
  start/stop, tracking persistence after End Ride, activity tap to Home, and saved
  speedometer toggle all work on the physical iPhone. The source commit
  skips website deployment; publish the revised Help/privacy text to the live
  support website before public app release. No upload has occurred.
- The bundled-interface build 1.0 (2) supersedes the earlier hosted build.
  Both mobile projects now package screens and assets locally. Root/mobile type
  checks, both frontend builds, 108 tests, signed iPhone build/archive/export,
  installation, and production public-data API smoke checks passed. The launch
  attempt was initially blocked by the locked phone; the owner then opened OOS
  and confirmed Home, Map, Ride, and offline Home/Help work. Exported
  app/widget profiles, signatures, versions, production APNs, and disabled
  debugging were verified. The requested bundled-screen and offline checks are confirmed by the owner;
  notification/Live Activity tests remain pending. No upload occurred.
- Spot reporting has been removed from the app, API, and admin navigation. The
  historical database migrations and seven-day cleanup remain intact for older
  records; no production database data was deleted. The removed live `/api/spot`
  endpoint returned 404 after deployment.
- Live tracking is implemented as an opt-in native location session and
  WidgetKit Live Activity, independent of takeoff-alert push delivery. The button,
  privacy text, and help content are published; both the app and widget are
  included in the signed iPhone build. Before listing the feature,
  verify start/stop, updates while another app is open and while locked, stale
  data, permission denial, system dismissal, and the Home deep link on a
  physical device. Native calculation checks and builds do not verify those
  system behaviors.
- The Settings Store link opens an apparel gallery labeled “Coming soon.”
  Finish that experience or remove the unfinished entry from the release before
  submission; do not advertise purchasing while no checkout exists.
- The iPhone app packages its interface locally. Demonstrate the tested map,
  location, Ride Mode, and notification utility in review. Approval is still
  subject to Apple's minimum-functionality assessment.
- Verify permission to distribute each aircraft-data source and map asset in the
  intended regions. Public availability alone is not proof of redistribution rights.

These checks relate to Apple's [review guidelines](https://developer.apple.com/app-store/review/guidelines/),
particularly app completeness, minimum functionality, and third-party content.
Device testing and the operational release checklist are in [the mobile README](../mobile/README.md).
