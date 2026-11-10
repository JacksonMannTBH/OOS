# Apple review fixes — development only

October 26, 2026. Scope authorized by the owner: local changes and direct installation
on Jackson’s iPhone. No website deployment, TestFlight upload, App Store submission,
or message to Apple is part of this work.

## Changes

- Home now has independently scrolling content above a fixed bottom action area.
  Start Ride and View Map remain visible, with 16 pixels above the bottom safe area.
  Logo and spacing adapt to the available height.
- View Map has a dark label on its light button for legibility.
- Per the owner's follow-up, Live Tracking uses the original small pill style at
  the top left of Home, now labeled Start Live Tracking / Stop Live Tracking.
  Background-location copy remains in its tooltip and accessible description;
  the large explanatory box has been removed.
- Live Tracking is controlled from Home; Ride Mode has only End Ride in its
  action area. End Ride leaves separately enabled Live Tracking on. The Ride layout scrolls
  when space is limited. The speedometer is restored to its original position
  above and to the left of the map, with space reserved below the heading.
- Start Ride starts an independent native ride recorder after a one-time explanation
  and precise-location permission. It records estimated distance, duration, and top
  recorded speed while foregrounded, using other apps, or locked. A deep link into
  Ride Mode without an active recording returns to Home for the normal Start Ride flow.
- End Ride saves the summary before navigating Home and opening it. Home shows
  the latest three summaries as date/time and statistic rows with no section heading.
  Rows reopen the summary. Returning Home
  during an active recording shows Resume Ride and does not create another ride.
- Only three summaries are retained on the phone in Application Support, excluded
  from backup. No route coordinates are persisted or uploaded by the recorder.
  Atomic writes protect the previous save; write failures leave the ride active.
- GPS samples with poor accuracy, jumps, or stale times are excluded. Neighboring
  speed samples confirm a peak; missing intervals are not bridged for distance.
  On a process restart, the last saved active ride becomes a partial summary;
  recording does not silently restart or claim to include force-quit time.
- Ride recording has its own location manager and background activity session.
  Stopping aircraft Live Tracking leaves recording active; End Ride leaves any
  separately enabled aircraft Live Tracking active. Help and privacy copy explain both.

## Verification

- Mobile TypeScript check and packaged web build pass.
- 14 native ride-recording tests and 15 ride-format/ride-mode tests pass.
- `tests/visual/scripts/app-review.mjs` checks the packaged interface at phone,
  small phone, iPad portrait/landscape, phone landscape, and increased text sizes.
  It checks Map access, start tracking, End Ride retaining tracking, stopping from
  Home, Home state reconciliation, no speedometer/heading overlap, and readable
  permission errors. Native plugins and remote data are test fixtures, so these
  checks do not prove real background GPS or push delivery.
- `tests/visual/scripts/ride-history.mjs` additionally checks three history rows,
  fixed bottom actions, summary access at all six sizes, consent/cancellation,
  permission and storage errors, resume without duplication, independent Live
  Tracking, End Ride summary, history reload, direct-link recovery, and native recording started from the map.
- Build 20 simplifies the UI per the owner's request: no Partial recording label,
  no recording status line above Ride Mode, and a borderless summary containing
  its date/time, three statistics, and Done button. The Delete ride button and
  explanatory text below Duration are removed. The native recorder is unchanged.
- Build 21 removes the No Eyes headline from Home, uses system monospace fonts
  throughout the app interface, and shortens the summary labels to Top speed and
  Distance. Both Home entries and ride summaries show start and end times, with
  both dates when a ride crosses midnight. Start Ride and View Map remain fixed
  at the bottom. Home uses a solid black background with no texture. The summary's
  Done button retains its gold fill with no border.
- Build 22 removes the Ride Mode placeholder and Start Recording fallback button.
  The map uses the same Start Ride / consent / native recorder flow as Home.
  Home now shows a single-line Active Air Support heading with matching aircraft
  icons and colors. Icons center when they fit and scroll horizontally otherwise;
  selecting an icon opens the map focused on that aircraft. The section hides
  when no aircraft are active, preserving ride history and fixed bottom actions.
- Build 23 switches app interface text to IBM Plex Sans. Official IBM WOFF2
  fonts and their SIL Open Font License are bundled locally, including normal
  and italic weights 400–700, so the font works without a network connection.
- Build 24 enlarges the Home status heading to 24–32 pixels while retaining
  a single line, and restores No Eyes after a successful empty aircraft response.
  The aircraft icon row remains visible only when aircraft are active.
- Build 25 removes Stop Live Tracking from Ride Mode. The Home control and
  independent recording/tracking sessions remain unchanged.
- Build 26 shortens the first-use Record your ride message to the requested copy:
  “Uses your location to record speed, distance, and duration. Tap End Ride to stop
  recording.” Start Ride and Cancel remain. Type checking and the existing ride
  history/consent browser checks passed before installation.
- Build 27 moves Settings into the top header on the settings hub and removes
  its duplicate heading. Preferences and Out Of Sight groups become one list
  with consistently sized rows. Type checking, phone/iPad browser layout checks,
  and display-settings/home navigation checks passed. Screenshots and build/install
  records are in `.local/dev-settings-27/`.
- Build 28 removes all four eyebrow labels from Notifications & state: Settings ·
  Alerts, Alerts, Delivery, and Tracked fleet. Type checking and phone/iPad browser
  checks passed, including state selection and back navigation. Screenshots and
  build/install records are in `.local/dev-settings-28/`.
- Build 29 simplifies the Takeoff notifications card by removing explanatory
  paragraphs and redundant on/off confirmations, and shortening the state label.
  Permission, reconnection, and error guidance remain, as does test-notification
  feedback. Type checking and browser checks of on/off/denied/reconnecting states
  passed at phone and iPad sizes. Records are in `.local/dev-settings-29/`.
  Installation succeeded; automatic launch was blocked because the phone was locked.
- Build 29 is a command-line override for this Debug installation. The checked-in
  release build number remains unchanged. App and widget use the same build number.
- The final signed Debug build succeeded and was installed directly on Jackson’s
  iPhone. Its bundled interface was compared byte-for-byte with the tested assets.
- The native iPad simulator attempt could not be completed: its installation
  service failed with a Mach server error. iPad-sized browser checks passed;
  native iPad behavior is not claimed as verified.

Build logs, screenshots, and installation records are in the ignored
`.local/dev-apple-review/`, `.local/dev-apple-review-16/` through `.local/dev-apple-review-18/`,
and `.local/dev-rides-19/` through `.local/dev-rides-26/` directories. A physical-device background-location recording
and testing on Apple's reported iPadOS 27.2 remain prerequisites for a later review
response; only iOS 27.0 is installed locally as a simulator runtime.

For the device ride test: Start Ride and allow Precise Location, record movement
with the phone locked and with another app in front, reopen OOS, then End Ride.
Check distance and top speed against the route, confirm the summary survives a
relaunch, and confirm ending the ride stops its location session. Exercise Live
Tracking independently, and verify a forced quit produces a partial saved ride.
Browser fixtures and deterministic native samples do not replace this test.

## Release preparation authorized October 26

The owner confirmed the physical-phone background ride and separate Live Tracking
test works, and is preparing the demonstration recording and App Store screenshots.
The owner authorized native iPad simulator checks and a release upload for
TestFlight. Public App Store resubmission is still pending those review materials.
The only installed simulator runtime is iOS/iPadOS 27.0; results must not be
represented as testing on Apple's reported 27.2.

Native release simulator verification subsequently passed on iPad Air 11-inch (M3)
with iPadOS 27.0, in both device orientations. Start Ride and View Map remained
reachable with three saved rides; map navigation and the first-use ride confirmation
were exercised. The passing result is `.local/release-1.0-30/iPadFinal.xcresult`.
This supersedes the earlier failed simulator setup attempt, not the 27.2 limitation.

## Location lifecycle follow-up — build 31

After installing TestFlight build 30, the owner reported a location indicator
while outside OOS with both Home buttons showing Start. Phone diagnostics showed
Live Tracking had stopped without recovery, and the ride archive had no active
ride. This does not establish ongoing background location delivery by itself.

Home and map previously held ordinary geolocation watches until component
unmount. The shared location boundary now clears them on document visibility
changes and Capacitor pause events, then creates fresh watches on foreground
return. Pending registrations are also cleared, and late callbacks are ignored.
The native ride and Live Tracking managers remain separate and unchanged.

All 148 app tests passed, including 10 location tests. Packaged app fixtures
verified background suspension with both features off and preserved active ride
and Live Tracking state. Mobile type checking, Release archive/export, signature
checks, production APNs entitlement and bundled asset comparisons passed. These
checks do not replace a physical-device test of the location indicator and
background ride recording in build 31. Artifacts: `.local/release-1.0-31/`.

The owner subsequently confirmed on TestFlight build 31 that the location
indicator clears outside OOS while both controls show Start. The owner also
confirmed active background ride recording and Live Tracking still work on 31.

## Live Tracking last result — build 32

Live Tracking now starts from the last measured result saved on this phone for
the same state, aircraft selections and distance bands. Stop and process restart
preserve that result without keeping location tracking on. Its aircraft, distance
and original observation time remain intact until a new measured result arrives.
With no saved result, the activity shows only Live tracking and an empty distance;
it does not invent Clear or display Starting/Updating/unavailable-data messages.
Changing region or filtering preferences invalidates incompatible saved results.

An airborne aircraft without a usable position no longer suppresses all other
located aircraft in the selected state. The nearest usable contact determines
the result. If all airborne positions are unavailable, the previous result stays
visible; only a healthy feed with no selected airborne aircraft reports none.

All 40 native calculator, recovery and shared-storage checks passed. Physical
Live Activity rendering and restart behavior in build 32 still require the owner
to verify on their phone. Build artifacts are in `.local/release-1.0-32/`.

Build 32 archive/export, signature and production APNs checks passed. The bundled
interface matches all 204 previously tested files. Uploaded October 26 at 1:35 PM
Pacific; App Store Connect reports Testing in Owner Phone Testing (one tester).
The public App Store submission was not changed.

## Submission setup — October 26, 2026

At the owner's request, selected build 1.0 (32) in place of build 11 for the
existing submission. Saved and verified updated review notes covering the iPad
scrolling fix, simulator OS limitation (27.0), ride recording, independent Live
Tracking controls, and background-location testing instructions. Removed the
outdated aircraft-widget claim from promotional text. The approved description
and six padded screenshots remain in place.

Used Update Review to stage the revised version. App Store Connect now shows
build 32 Ready for Review with Resubmit to App Review enabled. The final
resubmission button was not clicked. Saved an unsent reply draft addressing both
rejection reasons; the owner will attach their physical-device video and send it.
No video has been uploaded by the agent. Physical build 32 verification remains
unconfirmed in this conversation.
