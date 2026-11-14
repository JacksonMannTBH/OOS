# Android handoff source — updated through build 147

Branch: `android/build-145`. Originally saved from OOS 1.0.2 (145) on November
13, 2026, and updated at the owner's request on November 14 with the fixes in
phone build 147. It starts from the previous `android/build-97` source snapshot.

The snapshot includes the latest Home, map, Ride, G-force, Stats, history,
settings and transition UI; nationwide aircraft support; the v1/v2 receiver;
and the tested v3 aircraft field-delta codec and automatic format negotiation.
The regular app contains neither the OOS Test banner nor its local Mac feed.

## Included fixes after build 145 — November 14, 2026

These changes are included in the updated branch. Regular OOS 1.0.2 (147)
with these fixes was installed and launched on the owner's iPhone on November
14. The branch name is retained for the Android handoff.

- The shared G-force dot now shows outward load on both axes: a left turn moves
  it right, a right turn moves it left, braking moves it up and accelerating
  moves it down. The bridge's lateral sign remains positive for rightward bike
  acceleration. Negate it to obtain rightward load. Native `maxLeftG` and
  `maxRightG` now record left/right load to match the dot; neither means turn
  direction. For a sustained positive load, raise right G; for a sustained
  negative load, raise left G. Keep the 200 ms peak-confirmation window. Saved
  summaries use `Left` and `Right`, with no turn wording. Android must normalize
  its own sensor conventions before using the shared display.
- Existing iPhone G-force summaries without `lateralReference` stored the old
  turn-direction peaks. Swap their left/right values once during load and
  persist `lateralReference: "load"`; new summaries set that marker from the
  start. Do not swap already marked data or change acceleration/braking values,
  calibration, sample counts or angle peaks. If Android has adopted the old
  semantics, apply equivalent migration to its local store. Swift checks cover
  both load directions with lean/tilt and repeat-save migration; the browser
  checks dot direction, smoothing and load labels.
- Yellow/amber aircraft palette slots are replaced with pale slate and purple
  while preserving palette length and slot order. Existing aircraft assigned
  other colors keep them. Default aircraft glyph accents, fallback flight paths,
  aircraft detail trails and ride-map aircraft indicators use non-yellow colors.
  Brand controls, roads and ride warning status retain their existing colors.
  These palette/display changes are shared with Android after rebuilding assets.
- G-force opens from both Map and Stats with the shared 220 ms turn-and-fade
  panel animation. It runs only on entry, keeps the same final circle size, and
  is disabled for Reduced Motion. This is shared CSS and ships to Android after
  rebuilding the packaged interface.

Local validation: 53 native motion/G-force/history checks, both aircraft-color
checks, root/mobile type checks, the packaged interface build and the browser
motion flow passed. The browser flow verifies outward dot direction in both
turns, simultaneous braking/acceleration, smoothing and load peak labels, plus
the G-force entrance from Map and Stats and immediate entry with Reduced Motion.
The signed phone build's 211 packaged interface files matched the generated
interface; app and widget both report build 147. The backend remains unchanged.

## Backend timing

Keep the live backend unchanged until Apple publishes the new app. Saving this
branch does not deploy the included backend source or migrations. Today,
`/live?state=WA&version=3` returns v1 and the client uses existing v2 broadcasts.
The future backend contract, including exact persisted recovery baselines and
the separate private `oos-live-v3:STATE` topics, is in `live-updates.md`.
Actual production Supabase v3 delivery has not been validated yet.

## Android work

Build the Capacitor app in `mobile/android`; the root `android/` directory is
the older Bubblewrap/TWA project. The shared React screens and receiver are
available to Android after rebuilding and syncing the packaged interface:

```sh
npm ci
cd mobile
npm ci
npm run typecheck
npm run sync
npm run open
```

Retain the existing Android Firebase configuration and Play upload key on the
Android build machine. They are intentionally excluded from Git. Choose the
next Android version code/name based on the existing Play release; the iPhone
build number does not set the Android version code. This snapshot has not
built, signed, installed or uploaded an Android APK/AAB.

Native ride recording, G-force, lean/pitch sensing and iPhone Live Activities
are implemented in Swift. `hasRideRecorder()` currently enables the native
recorder only on iOS. The shared G-force screen alone does not supply Android
motion readings or background ride recording. Port the required native bridge,
sensor calibration/axis conventions, peak handling, persistence and lifecycle
behavior before claiming Android feature parity. See `ride-gforce.md`,
`ride-motion.md`, `ride-stats.md` and the Swift sources/tests under `mobile/ios/`.

## Validation captured with build 145

- 251 automated checks passed, including the v3 codec and negotiation tests.
- Root and mobile TypeScript checks and the packaged interface build passed.
- The signed iPhone app and widget both use 1.0.2 (145); 211 packaged interface
  files matched the generated interface.
- Read-only WA, CA and TX checks confirmed current-backend compatibility.
- The owner reported successful physical-phone testing of the recorded v3 feed
  in OOS Test. The regular build was installed afterward for UI/UX review.

Generated native build folders, local test captures/keys, screenshots and
installation logs remain outside this source snapshot. Local build evidence is
in `.local/appstore-1.0.2-145/`, `.local/phone-build-146/` and
`.local/phone-build-147/` on the Mac that built them.
