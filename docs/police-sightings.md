# Police sightings — development build 86

November 9, 2026 (Pacific). Requested for direct installation on Jackson’s iPhone.

Ride Mode has a 104 × 76 police report button on the right, aligned with the
existing speed badge. It uses a filled saffron officer icon and remains present
when the speedometer is hidden. A successful or duplicate submission receives a
brief checkmark; there is no duplicate-report text. New submissions offer Undo
for ten seconds. Network and location failures do not claim a successful report.

An active sighting within one statute mile replaces the text below the aircraft
status with “Police Ground Unit Nearby.” The aircraft status itself is unchanged.
Ride-map markers have no interaction or report details. The main map opens a
report count and last-report time only when its police icon is tapped.

## Shared reports

- Reports use a fresh location fix at submission, never the map center. The
  server resolves the actual state using the existing Census geocoder service.
- Both screens filter by the selected state, including immediate filtering on
  selection changes. California’s aircraft-region preference does not narrow
  police reports beyond the selected state.
- New reports join the nearest active sighting anchored within 402.336 meters
  (¼ statute mile), in the same state. The first report fixes the grouping anchor
  so chains of reports cannot gradually combine distant sightings. The marker
  displays the most recent active report’s coordinates. Grouping uses distance
  and state; it does not identify roads or carriageways.
- One unexpired confirmation per device per sighting. Duplicate reports do not
  extend expiration. Different sightings have a 30-second cooldown, enforced
  under database locks even for simultaneous requests. Undo preserves cooldown.
- Each confirmation expires after 30 minutes. Reads count only active reports;
  the marker disappears when the last confirmation expires. Foreground screens
  refresh every 15 seconds and remove expired markers locally, including offline.
  Polling stops while the screen is hidden or offline.
- A separate 256-bit device capability is durably saved in native preferences.
  Only its SHA-256 hash is stored server-side; no device identity appears in map
  responses. This is device-level duplicate prevention, not account identity or
  proof that a submitted GPS position is genuine.
- Undo requires the same device capability. Tables and RPCs are available only
  to the server role. Expired rows are deleted by an isolated minute cron job.

## Deployment boundary

New Edge Function: `oos-police`, in OOS project `ohhixakjamjocgmatbha`.
Its body validates the existing publishable client key; gateway JWT checking is
disabled because publishable keys are not JWTs. Client keys cannot read tables
or call the storage RPCs directly. Credentials never enter the app bundle.

The migration adds only `oos_police_sightings`, `oos_police_reports`, their RPCs,
indexes, grants, policies, and `oos-police-expiry`. No existing aircraft tables,
ingestion workers, notification functions, schedules, or app API functions were
replaced. The mobile network adapter sends only `/api/police` to the new endpoint.
Older builds continue to use their current endpoints and cannot display reports
until updated. The website and App Store/TestFlight release were not published.

Build with `node scripts/build-police-backend.mjs`. Deploy the generated
`.local/cloud-functions/police.js` only as `oos-police`; do not deploy unrelated
bundles to add this feature. The existing app API remains version 12.

## Verification

- 188 app/backend tests passed; mobile and website TypeScript checks passed.
- Transactional database assertions passed for grouping, non-chaining,
  cross-state isolation, duplicates, cooldown, expiry, Undo ownership, and
  anonymous RPC/table denial. All fixture writes were rolled back; no test
  sightings were published.
- Live endpoint checks passed for WA/CA/TX reads, invalid-key rejection, malformed
  report rejection, Capacitor CORS, and geocoder-based rejection outside supported
  states. Existing aircraft API checks passed without sending notifications.
- Security advisors found no new findings. The pre-existing informational entry
  for `notification_landing_receipts` remains unrelated to this change.
- Packaged-interface browser checks cover button size/alignment, selected-state
  markers, hidden speedometer, checkmark/cooldown/Undo, state changes through the
  real settings selector, main-map details, and expiry removing an open popup.
  Browser GPS and backend responses are fixtures, not a physical road test.
- Signed iPhone build 1.0.1 (86), with all 205 packaged asset files verified
  identical to the tested interface. Build/install evidence and screenshots are
  in `.local/police-86/`.
- Direct installation and launch on Jackson’s iPhone both succeeded. The main
  app and widget have matching build 86. Existing Edge Function versions and
  artifact hashes were verified unchanged after deploying `oos-police`.

Physical road use and a genuine sighting submitted from the phone still need
user verification. Do not publish fabricated reports as a deployment test.

## Build 87 — smaller blue markers

Police icons use bright blue `#4DA3FF`. The main-map badge is 28 pixels across
inside a transparent 44-pixel touch target; the noninteractive ride-map badge is
22 pixels. The report button keeps its original 104 × 76 dimensions and now has
a blue icon. The main-map popup uses two short lines, such as “4 riders” and
“2 min ago,” with a compact dark background and blue outline. Full descriptive
text remains available to screen readers. The aircraft information row and
nearby-alert wording are unchanged. No backend changes were needed.

Mobile type checking and packaged-interface checks passed, including marker
sizes, preserved tap target, popup size, report/Undo, selected-state filtering,
and expiration. Screenshots and build records are in `.local/police-87/`.

## Build 88 — nearby alert colors and no Undo

Removed the Undo control and its client action. The report button still gives
a brief checkmark and enforces the existing cooldown. Updated the in-app privacy
copy to remove the Undo instruction. Older builds' server endpoints remain intact;
no backend deployment was needed.

“Police Ground Unit Nearby” alternates between blue `#4DA3FF` and red `#FF5A65`
once per second, without hiding the text. Reduced Motion keeps it steady blue.
The animation applies only to this message while an active, selected-state report
is within one mile. Existing expiry and state filtering remain unchanged.

Mobile type checking and the packaged-interface checks passed, including actual
blue/red animation colors, Reduced Motion, absence of Undo, report confirmation,
cooldown, map details, state filtering, and expiry. Build evidence is in
`.local/police-88/`.

## Build 89 — main-map zoom cutoff

The main map hides police markers below zoom 10, closes their open detail
popups, and restores the markers when zoom returns to 10 or higher. Data
refreshes use the current zoom, so they cannot make hidden markers reappear.
The invisible tap target is also hidden. Ride Mode always displays its active,
selected-state police markers regardless of its map scale; its one-mile nearby
message is unaffected. No backend changes are required.

Build and interface-test records are in `.local/police-89/`.

## Build 90 — smoother nearby alert and clean markers

The nearby text holds blue and red briefly, with eased transitions on a
2.4-second cycle. It stays fully visible throughout, and Reduced Motion keeps
it steady blue. Police markers suppress native tap highlighting, shadows, and
filters; keyboard focus uses a thin blue outline instead of the white ring.
Marker sizes, touch targets, popup behavior, and zoom rules are unchanged.

Mobile type checking and packaged-interface checks passed, including both
alert colors, an intermediate transition color, Reduced Motion, and marker
effects after tapping. Native build 90 and its packaged assets were verified.
Build and interface-test records are in `.local/police-90/`. No backend changes.

## Build 91 — police alert becomes the ride headline

When a selected-state sighting is within one mile, “Police Ground Unit Nearby”
occupies the main heading position with the existing blue/red animation. The
aircraft status moves directly underneath at 18–24 pixels, retains its status
color, and drops its glow. The aircraft update time follows it. Once the police
alert clears, the original large aircraft status and supporting copy return.

Mobile type checking and packaged-interface checks passed, including headline
placement and relative text sizes at 320- and 393-pixel widths, restoration of
the normal status after changing state, animation, and existing police behavior.
The ride screenshot was visually reviewed. Evidence is in `.local/police-91/`.
No backend changes.

## Build 92 — shorter police headline and explicit aircraft status

The ride headline now reads “POLICE NEARBY.” The smaller status beneath it
reads “Aircraft · CLEAR” (or the current aircraft status), followed by the
muted “Updated…” time. The police headline retains the blue/red animation.
When the nearby alert clears, the original large aircraft status returns
without the “Aircraft” prefix.

Mobile type checking and the packaged-interface checks passed. The headline
fits one line at 320- and 393-pixel widths, and the regular status returns when
the alert clears. The ride screenshot was visually reviewed. Evidence is in
`.local/police-92/`. No backend changes.

## Build 93 — report button flashes with the nearby alert

While the nearby police alert is active, the report button icon and outline
use the same smooth 2.4-second blue/red animation as the headline. When the
alert clears, the button returns to its normal blue icon and muted outline.
Reduced Motion keeps the alerting button steady blue. Report confirmation,
cooldown, dimensions, and selected-state/range rules remain unchanged.

Mobile type checking and packaged-interface checks passed, including the
button's blue/red/intermediate colors, matching outline color, Reduced Motion,
and return to a steady appearance after the nearby alert clears. The ride
screenshot was visually reviewed. Evidence is in `.local/police-93/`.
No backend changes.

## Build 94 — steady report-button border

The report button keeps its normal muted border throughout the nearby alert;
only its icon changes between blue and red. Mobile type checking and the
packaged-interface checks passed, including an unchanged border at both color
phases. Evidence is in `.local/police-94/`. No backend changes.

## Build 95 — remove the location pulse behind police markers

The pale glow visible behind overlapping police markers came from the rider
location marker. Removed the main map's location-marker size pulse and its
two translucent halo circles, retaining the location dot at a steady size.
Removed the ride map's blurred location halo as well. The location dot,
distance rings, aircraft animations, police markers, and alert flashing remain.

Mobile type checking and packaged-interface checks passed. Screenshots of both
maps were reviewed and show clean police badges without the underlying halo.
Evidence is in `.local/police-95/`. No backend changes.

## Build 96 — first-use explanation and nearby voting

The first police-button tap opens an explanation. Got it durably records the
acknowledgement on this phone and closes without sending a report. Closing
without acknowledging shows the explanation next time. Subsequent taps obtain
a fresh location and check for an active sighting within the existing quarter-mile
grouping radius. Nearby sightings open a dialog with large Still Here and Not Seen
buttons and a close control. With no nearby sighting, the intentional tap reports
normally. If another report appears between checking and submitting, the server
requires confirmation rather than silently counting a vote.

The original report counts as Still Here. Each device can vote once per sighting;
repeated or opposite votes from that device do not add votes or refresh expiry.
New positive confirmations refresh the shared 30-minute expiry. Negative votes
never extend it. The sighting is permanently hidden once unique negative votes
reach twice the unique positive count. Older positive votes remain in the count
for the lifetime of an extended sighting, and removed sightings cannot resurrect.
The existing 30-second device cooldown applies to both reports and votes.

Migration `20261110022413_police_sighting_votes.sql` adds vote classification and
removal state to the existing private police tables. The police-only cleanup
keeps voter identities until the sighting expires, or 30 minutes after removal.
The service-only RPCs validate proximity and serialize voting; old reporting and
withdrawal RPCs remain compatible. Only the `oos-police` Edge Function was updated
(version 2); unrelated function versions and bundle hashes were verified unchanged.
In-app Help and privacy text now describe the new workflow and retention.

All 190 automated tests and mobile type checking passed. Rolled-back database
fixtures verified 1:2 and 2:4 removal, duplicate prevention, positive-only expiry
refresh, state/proximity isolation, no resurrection, race confirmation, older
clients, and restricted RPC permissions. The security advisor reported no new
findings. Live reads and read-only preparation passed without publishing test
sightings. Packaged-interface checks covered both dialogs, dismissal, no initial
submission, acknowledgement surviving native-preference restoration, both vote
choices, error/retry handling, and normal reporting. Dialog screenshots were
visually reviewed. Records are in `.local/police-96/`.

This is a direct phone build. The App Store replacement remains paused; build 85
is still the submitted build and neither build 95 nor 96 has been uploaded.
The signed build 96 was installed successfully after a wireless retry. Packaged
assets and matching app/widget build numbers were verified. Automatic launch
was denied because the iPhone was locked; the owner can unlock it and open OOS.

## Build 97 — simpler police dialogs

Removed the nearby-rider confirmation sentence from the first-use explanation
and centered the nearby-vote dialog heading. Packaged-interface checks passed,
and both dialog screenshots were visually reviewed. The signed development
build 97 was installed on the owner's phone. Evidence is in `.local/police-97/`.
No backend or App Store changes were made.

## App Store resubmission — version 1.0.1 (97)

The owner resumed App Store delivery after testing build 97. The release archive,
export, signing checks, production notification entitlement checks, and live
backend checks passed. All 205 packaged files match the tested phone interface.
Build 97 uploaded and Apple processing completed without errors or warnings.
The pending build 85 submission was canceled, build 97 selected, and version
1.0.1 resubmitted. Apple returned Waiting for Review. Existing screenshots were
preserved; release notes and reviewer instructions now describe police reports,
the first-use explanation, and nearby voting. Automatic release after approval
remains selected. Records are in `.local/release-1.0.1-97/`.
