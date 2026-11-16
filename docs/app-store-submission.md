# Out Of Sight App Store release

## Submitted 1.0.3 (192) — November 16, 2026

After reviewing build 192 on the phone, the owner requested the App Store
upload. App Store Connect showed 1.0.2 already released, so the marketing
version was advanced to **1.0.3**, keeping build **192**. The app and widget
were archived and uploaded successfully through Xcode Organizer. Apple
processed the build successfully and confirmed **Waiting for Review** at
22:37 UTC. **Manual release** is retained; approval will not publish the app
automatically.

- App Store version: `eda93fa3-6c4e-40bf-98ea-26b9b1d08965`
- Build: `69a0f77a-56d0-4517-997c-54e35dbecb71`
- Review submission: `46123f68-f527-4a13-9512-75f12b035437`

The upload contains all 211 interface files from the phone-reviewed build,
with the native sources unchanged apart from the marketing version. Signed
distribution checks verified app/widget versions, production notifications,
App Group access, and disabled debugging. Membership pop-ups, Pro/Elite labels,
Elite Settings, native billing, and rider sharing remain excluded. Their
verified source backup is preserved in
`references/membership-preview-2026-11-16/`.

The owner's exact approved description from
[`references/app-store-1.0.2-192/description-approved.txt`](../references/app-store-1.0.2-192/description-approved.txt)
is saved and verified in App Store Connect for 1.0.3. Release notes cover the
Live Tracking layout, stale-aircraft synchronization fix, and ten recent
rides. Reviewer instructions reflect this build and omit the old membership
announcement. Eight inherited listing screenshots are complete and ordered.
Private upload, signing, listing, and submission records are in
`.local/appstore-1.0.3-192/`. No backend deployment was made.

At the owner's subsequent request, the same build was added to TestFlight's
existing **Owner Phone Testing** group and all **ten existing individual
testers**. What to Test and beta-review instructions were saved and verified.
Apple confirmed **Waiting for Beta Review** at 22:52 UTC on November 16.
An additional individual tester was subsequently assigned, bringing the count
to eleven. At the owner's request, **automatic tester notifications are now
disabled for build 192**; only the requested individual may be notified. At
23:15 UTC, Apple confirmed that no build-wide notification had been sent and
rejected the individual invitation with `NO_INSTALLABLE_BUILDS` while beta
review was pending. Do not send a notification to all testers to work around
this restriction; the individual invitation remains pending approval and
distribution availability. The public App Store submission still uses manual
release. Private assignment, beta-review, and notification-policy records are
saved in the release folder above. Tester contact details remain private.

## Phone review 1.0.2 (192) — November 16, 2026 — memberships held for later

At the owner's request, build 192 excludes membership pop-ups, Pro/Elite tier
labels, Elite Settings, and rider-sharing UI. Normal mobile builds omit these
modules and the corresponding Help/Legal copy; direct membership links return
to Settings. Existing Ride Mode, stats, Live Tracking, takeoff alerts, flight
paths and nationwide maps remain available. The iPhone Release binary also
excludes native billing and rider-sharing classes. The latest aircraft-landing
synchronization fix and the updated Live Activity layout are retained.

The membership source remains in the repository, with a separate verified
470-file snapshot, file hashes, and restoration instructions in
`references/membership-preview-2026-11-16/`. The explicit membership-preview
build mode restores the saved interface for development with iPhone Debug;
the App Store checker rejects that interface for release upload.

The signed Release app and widget both report **1.0.2 (192)**. Installed and
launched on Jackson's iPhone for review, preserving all ten saved rides,
lifetime statistics, and preferences. The packaged interface matches all 211
tested interface files. Twenty screen checks passed in Chromium and WebKit,
including saved Free-plan native state, forced upgrade events, and direct
Elite links. Nine focused access checks, the mobile type check, native binary
exclusion checks, and local signed-release checks passed.

The owner initially requested phone review before App Store upload. That hold
was subsequently lifted by the explicit upload request recorded above. Phone
installation records and private backups are in `.local/release-phone-192/`;
preparation and UI evidence are in `.local/appstore-1.0.2-192/`.

The owner approved their edited App Store description for this version on
November 16, 2026. Use the exact copy in
[`references/app-store-1.0.2-192/description-approved.txt`](../references/app-store-1.0.2-192/description-approved.txt)
for build 192. This replaces the earlier description naming Washington,
California, and Texas. The approved wording was subsequently applied to
version 1.0.3 as recorded above.

## Phone review 1.0.2 (164) — November 15, 2026 — tier tags and ten recent rides

Installed and opened on the owner's iPhone. Free notification settings no
longer repeat Takeoff notifications beneath the header. Both that card and
Nationwide map place their Pro tag at the header's top right. Recent Rides
and the Stats settings entry have Pro tags for Free. Elite Settings has an
Elite tag for Free/Pro. Pro tags disappear for Pro/Elite; the Elite tag
disappears for Elite. Existing saved rides remain readable in Free.

Free hides Home's active-aircraft strip and nearest-aircraft information bar,
and the aircraft strip in the map header. Pro/Elite retain those details.
The native recent-ride archive and interface now retain and display ten
rides. Archive format, saved routes, and lifetime statistics are preserved;
the oldest recent summary is removed when an eleventh is saved. Existing
visual recording fixtures use the same ten-ride cap.

All 19 native history tests and 10 focused membership/formatting tests passed,
including retention overflow, deletion, storage round trips, and lifetime
stats beyond the recent cap. Mobile and scoped app type checks, packaged
assets, signatures, and signed iPhone build passed. The app type check
excludes the existing unrelated Play Store screenshot simulation error.
Chromium/WebKit checked all tiers, card-corner geometry across four layouts,
settings tags, ten saved rows and opening the tenth, paid aircraft details,
and Free exclusions on Home/map. Location and map data were mocked; WebKit
recorded two map-image decoding errors, so map rendering is not verified by
those browser assertions. Installation preserved saved rides, lifetime stats,
device preferences, and the current native membership selection. Backend and
App Store submission are unchanged. Evidence: `.local/membership-ui-164/`.

## Phone review 1.0.2 (163) — November 15, 2026 — membership banner behavior

Installed and opened on the owner's iPhone. The Settings membership banner
opens the Elite tab for Pro members and the Pro tab for Free members. Elite
members see no membership banner. A temporary Free button switches the native
development membership to Free: inside the banner for Free/Pro and on Settings
for Elite, so hiding the banner does not remove the way to return to Free.
The control is absent outside the native development membership mode. The
banner waits for membership status to avoid appearing briefly for Elite.

Seven focused membership tests, mobile type checking, packaged assets,
signatures, and the signed iPhone build passed. Chromium and WebKit verified
all three plans across four layouts, repeated banner opening, native switch
failure recovery, saved rider preferences, trial eligibility after returning
to Free, and absence of the Free control outside development mode. The Free
button is separate from the banner's main button, with no nested buttons.
The owner's Pro selection, three saved rides, lifetime stats, and device
preferences were preserved during installation. Backend and App Store
submission are unchanged. Evidence: `.local/membership-banner-163/`.

The recent-ride capacity review found matching limits of three in native
storage and the recent-rides interface. Retention is unchanged in this build.
A larger archive should separate completed routes from the active recording,
because recording currently rewrites the full archive for each location update.

## Phone review 1.0.2 (162) — November 15, 2026 — membership tags and flight time

Installed and opened on the owner's iPhone. Pro badges show only for a ready
Free membership; Pro and Elite see no upgrade badges. The map Flight Paths
button and Nationwide map toggle carry the badge for Free. Nationwide map
opens the Pro membership dialog for Free and honors Pro/Elite access even
when a nationwide preference remains saved after a downgrade. Settings,
Help, and Legal page headings no longer show introductory subtext.

Current-flight duration previously depended on a legacy field populated only
after a confirmed takeoff. The aircraft profile now derives Time airborne
from confirmed takeoff timestamps, or Time tracked from the recorded tracking
start. Last-known duration freezes at the last observation. The live ADSB.fi
sample contained 16 active flights, including 10 with tracking starts and no
legacy duration; all 10 now resolve to a tracked duration in the client.

All 22 focused tests, mobile type checking, scoped app type checking, packaged
assets, signatures, and the iPhone build passed. The full app type check still
reports the existing unrelated Play Store screenshot simulation type error.
Chromium/WebKit assertions verified tags, membership access, headers, and both
duration bases across three layouts. Map data was mocked; headless WebKit
used direct button events and recorded navigation/resource aborts, so these
checks do not verify its map rendering. The physical app opened successfully.
The owner's Elite selection, three saved rides, lifetime stats, and device
preferences were preserved. Backend and App Store submission are unchanged.
Evidence: `.local/settings-flight-162/`.

## Phone review 1.0.2 (160) — November 14, 2026 — trial eligibility

Installed and launched on the owner's iPhone. The Pro action and introductory
copy require a ready native status, no active membership and an explicit true
StoreKit trialEligible result. Used, unknown or loading eligibility shows the
monthly price instead. Development mode no longer overrides eligibility.
Elite continues to show $9.99/month without a trial.

Seven focused membership/eligibility tests, mobile type checking, packaged
interface and signed iPhone build passed. Chromium/WebKit verified returning
and unknown accounts receive no trial text, confirmed eligible accounts see
the trial action, active members see the price, and plan/settings behavior
remains correct across four layouts. App/widget build 160, signatures and
packaged assets were verified. Saved rides and lifetime stats were preserved.
Backend and App Store submission are unchanged.
Evidence: `.local/membership-160/`.

## Phone review 1.0.2 (159) — November 14, 2026 — membership actions

Installed and launched on the owner's iPhone. The separate membership trial
and monthly-price row is removed. The Pro action reads Free Trial Week; the
Elite action reads $9.99/month. The selected plan keeps its button label and
is disabled. Plan selection and the Settings menu entry behave as before.

Mobile type checking, packaged interface and signed iPhone build passed.
Chromium/WebKit verified the labels and removed row across four layouts,
plan selection, current-plan button state, all-tier Elite Settings entry and
saved rider preferences. App/widget build 159, signatures and packaged assets
were verified. Saved rides and lifetime stats were preserved. Backend and
App Store submission are unchanged. Evidence: `.local/membership-159/`.

## Phone review 1.0.2 (158) — November 14, 2026 — membership details

Installed and launched on the owner's iPhone. The trial pill and one-week trial
copy appear on Pro only. The banner feature is now Rider profiles. The Elite
Settings action has been removed from the membership dialog; the Settings menu
entry and its all-tier behavior remain available.

Mobile type checking, packaged interface and signed iPhone build passed.
Chromium/WebKit verified Pro-only trial presentation, prices, banner wording,
absence of the dialog settings action, plan selection and retained Elite
preferences across four layouts each. App/widget build 158, signatures and
packaged assets were verified. Saved rides and lifetime stats were preserved.
Backend and App Store submission are unchanged.
Evidence: `.local/membership-158/`.

## Phone review 1.0.2 (156) — November 14, 2026 — membership offers

Installed and launched on the owner's iPhone. Elite Settings is visible to all
plans: Free and Pro open the membership dialog with Elite selected; Elite opens
the settings themselves. Direct Elite Settings links apply the same gate.
The Use Free control is removed. Pro shows $2.99/month and Elite $9.99/month.
The Elite benefit label is Speed Sharing. The rounded Free Trial Week pill
appears beside the price on both plan tabs, including the currently selected
local plan.

Focused membership tests, app/mobile type checks, packaged interface and signed
iPhone build passed. Chromium/WebKit checked both prices, trial pill, all-tier
entry behavior, plan changes, saved Elite preferences, and four layouts each.
The app check excludes the existing unrelated Play Store simulation error.
App/widget build 156, signatures and packaged assets were verified; saved
rides and lifetime stats were preserved. Backend and App Store submission are
unchanged. Evidence: `.local/membership-156/`.

## Phone review 1.0.2 (155) — November 14, 2026 — Elite membership

Installed and launched on the owner's iPhone. Membership titles stay on one
line. The feature-list banner no longer includes Pro/Elite badges. The trial
is large on the left and monthly price smaller on the right. Memberships use
clean Choose Pro / Choose Elite controls, without development notices.

Elite is persisted by the native membership session, includes Pro access,
and alone exposes Elite Settings. Both the Settings entry and direct route
are gated; choosing Free or Pro removes Elite Settings without deleting rider
preferences. Username, rider icon, visibility and speed-sharing controls are
available in Elite Settings. No Elite price is assigned.

All 229 app tests, app/mobile type checks, packaged interface and signed iPhone
build passed. Chromium/WebKit verified four layouts, title/trial/price placement,
Free/Pro/Elite access, direct-route rejection, and saved Elite preferences.
The app type check continues to exclude the existing unrelated Play Store
simulation error. App/widget build 155, signature and packaged assets were
verified. Saved rides and lifetime stats were preserved. Backend and App Store
submission are unchanged. Evidence: `.local/membership-155/`.

## Phone review 1.0.2 (154) — November 14, 2026 — membership plan selector

Installed and launched on the owner's iPhone. The membership dialog is titled
“Out Of Sight Membership,” with accessible Pro/Elite tabs directly below it.
Pro pricing and the trial offer are below the benefits, before the purchase
control. Elite shows Coming soon without an invented price or billing product.
The centered Settings banner now uses a dark saffron-accented treatment and
small Pro/Elite labels.

Mobile type checking, packaged interface and signed iPhone build passed.
Chromium and WebKit verified both plans, keyboard selection, tier preview
persistence, legacy links and four layouts each. App/widget build 154,
signature and packaged assets were verified; saved rides and lifetime stats
were preserved. Backend and App Store submission are unchanged.
Evidence: `.local/membership-154/`.

## Phone review 1.0.2 (153) — November 14, 2026 — membership dialog

Installed and launched on the owner's iPhone. The Settings banner now reads
“Out Of Sight Membership,” centered with no secondary text, and opens the
existing membership dialog over Settings. The separate membership page has
been removed; older membership links also open the dialog over Settings.

Mobile type checking, the packaged interface and signed iPhone build passed.
Chromium and WebKit verified centered text across four layouts, the dialog
flow, persisted Free/Pro switching, and legacy links. App/widget build 153,
signature and all packaged assets were verified. Saved rides and lifetime
stats were preserved. Backend and App Store submission are unchanged.
Evidence: `.local/membership-153/`.

## Phone review 1.0.2 (152) — November 14, 2026 — membership preview

Installed and launched in the regular Out Of Sight app. Build 36's Free/Pro
membership preview is merged into the latest source through phone build 151.
Settings → OOS Pro has the separate saffron entry, one-week free-trial wording,
$3.99/month card, and persistent Preview Free / Preview Pro controls. Pro gates
new rides, Live Tracking, takeoff notifications and aircraft paths. Existing
rides remain resumable and finishable, and saved summaries/stats stay readable.
Current G-force/calibration behavior and Elite settings are retained.

All 229 app tests, app/mobile type checks, the packaged interface build, and the
signed iPhone build passed. The app type check excludes an unrelated existing
Play Store simulation with an optional-coordinate type error. Chromium and
WebKit checks passed across four layouts each. App/widget versions are both
1.0.2 (152), signatures and packaged assets were verified, and saved rides and
lifetime stats were preserved across installation and launch.

This is a native Debug preview; Release, web and Android feature access stays
as before. Real billing, App Store trial setup, and server subscription checks
are not enabled. The live backend and submitted App Store build 147 are unchanged.
Evidence, installation verification and the source backup are in
`.local/membership-152/`. See `docs/membership-preview.md` for the migration scope.

## App Store 1.0.2 (147) — November 14, 2026 — Waiting for Review

At the owner's request, build 147 was uploaded and submitted with the four new
iPhone listing designs: overhead map, Ride Mode, ride summary, and takeoff
alerts. Both iPhone screenshot sets now contain those four images in that
order; all eight files were processed by Apple and their checksums and sizes
verified. Release notes and reviewer instructions cover the current G-force,
ride statistics, angle calibration, nationwide state selection, and background
location behavior.

The signed Release archive and distribution package match all 211 tested
interface files. App and widget report 1.0.2 (147), signatures and App Groups
are valid, production notifications are enabled, and debugging is disabled.
Apple processed the build as Valid and App Store Eligible. The attached build,
review submission, and version were verified as Waiting for Review.

Manual release remains selected. The live backend is unchanged and must stay
unchanged until Apple publishes the app. Build 115 is superseded. Release
records, archive, distribution package, upload logs, and listing/submission
confirmation are in `.local/appstore-1.0.2-147/`.

## Phone review 1.0.2 (147) — November 14, 2026

Installed and launched in the regular Out Of Sight app. G-force now opens from
Map and Stats with the shared 220 ms turn-and-fade entrance. Live readings do
not restart the animation, and Reduced Motion switches immediately.

Root/mobile type checks, the packaged interface build and the browser motion
flow passed, including both entry paths and Reduced Motion. The signed app
and widget report 1.0.2 (147); all 211 packaged interface files match the
generated interface. Evidence is in `.local/phone-build-147/`.
This includes the prior build 146 fixes. At the owner's subsequent request on
November 14, the source and Android handoff notes were saved to
`android/build-145`. The backend remains unchanged. No App Store upload or
submission was made.

## Phone review 1.0.2 (146) — November 14, 2026

Installed and launched in the regular Out Of Sight app at the owner's request.
The G-force dot and L/R peaks now share the outward load direction; saved ride
summaries use Left/Right labels and old turn-direction peaks migrate once.
Yellow/amber aircraft colors, glyph accents, trail fallbacks and ride-map
indicators are replaced so aircraft remain separate from road colors.

All 53 native motion/G-force/history checks, root/mobile type checks, browser
motion checks and packaged interface build passed. Both aircraft-color checks
passed. The signed app and widget report 1.0.2 (146), and all 211 packaged
interface files match the generated interface. Evidence is in
`.local/phone-build-146/` and `.local/post145-load-directions-20261114/`.
The live backend is unchanged. At this installation, the remote Android
handoff branch still contained build 145. No App Store archive, upload,
review submission or release is part of this phone installation.

## App Store candidate 1.0.2 (145) — November 13, 2026 — phone review first

The owner requested a regular-app phone build to review UI/UX before continuing
App Store preparation. Build 145 includes the latest UI and the tested aircraft
field-delta receiver, with automatic negotiation that continues using today's
backend until a validated v3 feed is enabled. The backend must remain unchanged
until Apple publishes the app. The backend contract is in `docs/live-updates.md`.

All 251 automated checks, root/mobile type checks, packaged interface build,
signing configuration checks and signed iPhone build passed. Read-only checks
confirmed compatibility with the current WA, CA and TX backend responses.
The regular app and widget both use version 1.0.2 (145). No test banner or local
Mac endpoint is included. Evidence is in `.local/appstore-1.0.2-145/`.
This candidate has not been uploaded, submitted or released through Apple.
Installation of regular Out Of Sight build 145 was verified on the connected
iPhone. iOS blocked remote launch because the phone was locked; UI/UX review
is awaiting the owner opening the app. The App Store archive is not created yet.

## App Store 1.0.2 (115) — November 13, 2026 — paused by owner

At the owner’s request, automatic release was changed to manual and saved,
and the review submission was canceled in App Store Connect. The version page
now offers Add for Review, and manual release remains selected. Do not resubmit
or release this update without explicit owner authorization. Version 1.0.1
remains the public release.

## App Store 1.0.2 (115) — November 12, 2026 — Waiting for Review

The owner authorized submitting the latest phone build to the App Store. Build
115 includes the current Ride Mode layout, aircraft icons and compass
abbreviations, smaller estimated-fuel suffix, enlarged controls and readings,
and stationary helicopter rotors in the aircraft bar and ride map. It also
includes the subscription announcement and CHP region changes from build 103.

All 196 app tests, both type checks, live backend checks, and local release
checks passed. The signed Release archive and its widget are version 1.0.2
(115); all 211 packaged interface files match the tested phone build. UI checks
verified stationary rotor pixels, the single ride-map sprite frame, and the
Map/Stats toggle. The archive is saved in `.local/appstore-1.0.2-115/`.

At preparation, App Store Connect showed 1.0.2 as Prepare for Submission with
no build attached and no active review submission. Version 1.0.1 (97) was Ready
for Sale. Build 115 is now attached to version 1.0.2 and submitted for review;
both the submission and app version were confirmed as Waiting for Review.
Release notes and reviewer instructions match the latest UI. Ten existing
screenshot placements and automatic release after approval are retained.
Build 103 is marked superseded, and its submission script rejects a superseded
release record.

Command-line App Store export failed with `No Accounts`, including on retry,
despite the owner being signed in and the live Xcode Apple Accounts settings
showing the developer team and Admin role. Xcode Organizer successfully signed
and uploaded build 115. Do not infer that the owner is signed out from that
command-line error; use Organizer when this mismatch occurs.

The uploaded App Store IPA and widget have valid distribution signatures,
production APNs, the expected App Group, and debugging disabled. All 211 tested
interface files match the distribution package. Apple processed build 115 as
Valid and App Store Eligible, with non-exempt encryption set to false. Release
confirmation and the exported IPA are in `.local/appstore-1.0.2-115/`.

## App Store 1.0.2 (103) — November 12, 2026 — prepared only

Build 103 replaces the pending build 102. The subscription announcement now
disappears after its first opening, with native persistence across app restarts
and web-storage loss. All 30 catalogued CHP aircraft appear in both California
regions, including aircraft lists, map filtering, and takeoff notification
preferences. Manually disabled aircraft remain disabled.

All 196 app tests, both type checks, first-opening dismissal and persistence UI
checks across four layouts, and local release checks passed. The signed Release
archive matches all 211 tested interface files. App Store export is blocked:
Xcode has no signed-in Apple Developer account or accessible distribution signing
certificate. App Store distribution remains prepared at the owner’s request.
On a subsequent request, development build 1.0.2 (103) was installed on the
owner’s iPhone on November 12; its signature and all 211 bundled interface files
were verified. Build 103 has **not been uploaded or submitted to App Store Connect**.

Version 1.0.2's draft release notes and reviewer instructions are updated for
build 103. Records and the archive are in `.local/banner-chp-103/`. Finish export,
validation, and upload after signing in to Xcode when the owner resumes release
work. The final-submission script requires a processed, verified build and has
not been run. Build 102's release record and script mark it as superseded.

## App Store 1.0.2 (102) — November 12, 2026 — processing pending

Build 102 includes live ride Stats, estimated Lean and Pitch peaks, one-tap
calibration and an uncalibrated Stats prompt, peak reset, the map-first ride
summary, home map recentering, display improvements, and the upcoming-subscription
announcement. All 195 app tests, 33 native ride checks, both type checks, ride
history and motion UI checks, live backend checks, and release checks passed.
The signed archive and App Store export match all 211 tested interface files.

Apple accepted the upload at 2:11 PM Pacific. Version 1.0.2 is prepared with
verified release notes, reviewer instructions, ten inherited screenshot
placements, and automatic release after approval. It has **not been submitted
for review**: Apple reports an ongoing App Store Connect / App Processing
performance incident beginning at 1:11 PM Pacific, and build 102 remains
Processing with no reported errors or warnings.

Records and the guarded final-submission script are in
`.local/appstore-2026-11-12/`. Once Apple finishes processing, verify the current
status and run `submit-ready-build.py` from that directory using the repository
root as the working directory. It validates and attaches build 102, verifies the
review item, submits, and saves confirmation. The script has not been run.

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
