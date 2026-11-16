# Memberships — phone build 160

## Held from build 192 — November 16, 2026

The owner requested that the next App Store build exclude membership pop-ups,
Pro/Elite tier labels, Elite Settings, and rider sharing. The source remains
available in this repository. A verified snapshot of all 470 relevant source
files from before these release exclusions is saved in
`references/membership-preview-2026-11-16/source-before-build-192.tar.gz`.
Its README explains restoration and its manifest records each file's SHA-256.

Normal mobile builds now use release adapters: existing Ride Mode, statistics,
Live Tracking, takeoff alerts, aircraft paths, and nationwide maps remain
available. Elite routes redirect to Settings. The preview dialogs, settings,
rider profile service, and rider layers are omitted from the generated interface;
native billing and sharing code are excluded from iPhone Release builds. Help
and Legal omit the held sharing feature, and the release checker rejects a
preview bundle for App Store upload.

To revisit the existing development preview, run `npm run
build:web:membership-preview` or `npm run sync:ios:membership-preview` from
`mobile/`, then use an iPhone Debug build. Merge future changes rather than
restoring archived shared files over newer fixes.

Twenty release screen checks passed across Chromium and WebKit, including
direct links, forced upgrade events, and an available native bridge returning
a Free plan. Nine focused access/preview checks and the mobile type check passed.
Evidence is in `.local/appstore-1.0.2-192/`. The owner requested phone review
before any App Store upload, then authorized upload after review. Version
1.0.3 (192) was uploaded and submitted on November 16 with all these
exclusions retained; Apple confirmed Waiting for Review. Signed-package and
submission evidence is in `.local/appstore-1.0.3-192/`. Manual release remains
selected.

## Earlier preview history

Build 36's membership work has been integrated into the current app, retaining
newer ride recording, G-force, calibration, sightings, aircraft updates and
rider preferences. Build history is in docs/app-store-submission.md.

Settings has a centered single-line Out Of Sight Membership feature banner.
It opens a dialog with Pro/Elite tabs and clean plan-selection actions.
Pro retains the one-week trial and $4.99/month presentation, with the trial
larger on the left and the price smaller on the right. Elite lists the Pro
features plus rider profile, username, custom icon, visibility and speed-sharing
controls, at $9.99/month. Only the Pro tab shows the Free Trial Week pill.

Choosing Elite persists the native tier and includes Pro access. All plans
show Elite Settings. Free/Pro taps and direct links open the Elite membership
dialog; only Elite opens the settings themselves.
Choosing a different plan preserves saved Elite preferences; the Use Free UI
control has been removed. Existing rides remain
resumable and finishable, and saved history remains accessible. Recent Rides has
no Pro badge and shows five rows at a time, with scrolling to the remaining
saved rides. Stats requires Pro or Elite; Free members opening its menu entry
or direct route see the Pro membership dialog.

The local native membership bridge is Debug-only and supports Free, Pro, Elite
and StoreKit states. Builds without it retain existing Pro-feature access and
no Elite access. Native subscription signing and backend entitlement work remain
separate from this UI task; no backend deployment or App Store submission was
performed. Selecting plans in this build changes the local native membership.

Evidence, source backup and installation verification are in
.local/membership-156/. Focused membership tests, app/mobile type checks and the signed
build passed. The app check excludes the existing unrelated Play Store
simulation error. Chromium and WebKit checks cover four layouts, plan access,
Elite route guards and persisted username, icon and speed settings.

Build 158 removes the Elite Settings shortcut from the membership dialog while
retaining its Settings menu entry. The banner feature reads Rider profiles.
Current visual and installation evidence is in `.local/membership-158/`.

Build 159 removes the separate offer row. Free Trial Week labels the Pro action,
and $9.99/month labels the Elite action. Selected-plan buttons retain their
label while disabled. Current evidence: `.local/membership-159/`.

Build 160 makes Free Trial Week conditional on confirmed native StoreKit
eligibility. Used or unknown eligibility and active memberships show the
monthly price. Development mode does not bypass this check. Seven focused
tests and both browser engines cover these scenarios. Current evidence:
`.local/membership-160/`.

Aircraft name tags keep fixed positions on the full map and Home preview.
Overlapping tags render as complete units in a stable order, with the selected
aircraft's tag on top. Selecting an aircraft cannot mount or show flight
paths for Free members, and downgrading removes existing path layers. Free
members do not see Wake mode, Speedometer, or Lean and Pitch settings. The
G-force information card and individual distance-band descriptions are removed.
Time defaults to 12-hour while explicit saved 24-hour choices remain supported.
The About text uses connected prose without dash punctuation. Verification and
phone installation evidence are in `.local/display-map-166/`.

The membership dialog closes when users tap outside the box and has no Done
button. Inside taps and scrolling keep it open, and Escape still dismisses it.
This backdrop behavior applies to the membership dialog. Build 168 evidence is
in `.local/membership-dialog-168/`.

Build 169 adds fixed-position tag stacking and a flat yellow End Ride button
with a stop icon, pressed feedback and a saving indicator. The button text and
tap behavior are unchanged. Verification is in `.local/tag-stack-end-ride-169/`.
