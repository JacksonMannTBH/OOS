# Pig sightings — build 231

A normal police-button tap keeps the existing reporting workflow. Hold for
700 ms to play the selected real oink; release to report with a pig icon. Moving
more than 12 pixels, cancellation, multiple fingers, blur or leaving the screen
cancels submission. Space and Enter also support a hold. The first-use
explanation, location requirements and 30-second reporting cooldown still apply.

The icon is stored on one shared sighting, never in a device-wide theme. Both
maps use the server-provided `icon`; absent or unknown values render as police.
New clients see the pig regardless of which phone submitted it. Older clients
continue showing their original police icon until updated.

For a nearby sighting, the usual Still Here / Not Seen dialog appears. A newly
accepted Still Here vote from a hold makes that target a pig. A regular positive
vote preserves an existing pig. Negative votes, duplicate voters, cooldowns,
failed requests and race-confirmation prompts cannot change the icon. Other
sightings are unaffected. Existing grouping, expiry and removal rules remain.

The additive migration adds an icon constrained to police/pig, default police,
and a service-only invoker RPC that reuses the existing submission transaction
and locks. The live migration is `20261123232346_police_sighting_pig_icon`;
the CLI-created source is `20261123231933_police_sighting_pig_icon.sql`.
Only `oos-police` was deployed (version 3), with a minimal change to its prior
live bundle. Its existing state coverage and authentication were preserved.
All other Edge Function versions and bundle hashes were unchanged.

Audio: “Mudchute pig 3” by Secretlondon, CC BY-SA 3.0. The original Ogg and a
PCM WAV conversion are bundled for offline playback, with credit and license
links in Legal & privacy and `public/audio/pig-sound-credit.txt`. No creative edits were
made to the recording. Web Audio is unlocked during the gesture and retried on
release when iOS requires it.

Validation: ten police API/distance tests, mobile type checking, browser
checks in Chromium and WebKit (real decoded audio playback, both maps, second
viewer, normal taps, voting, race handling, cancellation, keys, error recovery
and marker popups), and trusted touch/multitouch checks. Rolled-back database
fixtures verified sharing and all unchanged submission safeguards. Security
advisories introduced no new findings. Live read and invalid-icon checks passed
without publishing test sightings. Build evidence is in `.local/pig-mode-231/`.
The full repository type check encounters an existing error in the untracked
Play Store ride-summary simulation (`summary.tsx:33`, optional coordinates).

## Build 232 — iPhone hold and playback

The police button and its SVG now explicitly disable WebKit text selection,
touch callouts and tap highlighting. A non-passive native touchstart listener
prevents the iPhone selection loupe and clears an existing selection only when
the button is touched. Short touch taps submit on pointer release because iOS
suppresses the synthetic click after touchstart is cancelled. Holds and cancelled
drags suppress subsequent clicks; mouse, keyboard and accessibility clicks remain
available. The shared sighting icon behavior is unchanged.

iPhone uses a registered `OOSSoundEffects` Capacitor plugin with AVAudioPlayer
and the same bundled WAV. It activates a short `.playback` audio session with
`.mixWithOthers`, so the intentional oink uses media volume even in Silent mode
and can play alongside other audio. Completion, decode failure or app backgrounding
stops playback, deactivates the session and restores its prior category. Browser
and Android retain Web Audio playback. A failed play is retried once on release;
if both attempts fail, the button shows an audio-specific error.

Checks cover trusted touch cancellation/selection suppression, short taps, holds,
multitouch, mouse drag, keyboard and native-plugin routing/failure feedback in
Chromium and WebKit. The native bridge fixture checks dispatch, not physical
speaker output. The iPhone release build verifies the plugin compiles and the
unchanged sound is packaged. No backend deployment is needed for this fix.

## Build 233 — selected second pig design

Replaces the original pointed-ear pig glyph with the previewed second design:
rounded ears, a rounder face and a larger two-tone snout. Both maps use the
same glyph for shared pig sightings. Normal police markers, reporting and the
build 232 sound/hold fixes retain their existing behavior.

## Build 234 — credits in Legal

Moves the sound credit section from About to Legal & privacy. The recording’s
title, creator, source, license, conversion notice and original download link
are retained in the existing Legal section layout.
