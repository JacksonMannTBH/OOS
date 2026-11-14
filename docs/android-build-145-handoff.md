# Build 145 source for the Android update

Branch: `android/build-145`. This snapshots the shared app and native iPhone
source used for OOS 1.0.2 (145), installed on the owner's iPhone on November 13,
2026. It starts from the previous `android/build-97` source snapshot.

The snapshot includes the latest Home, map, Ride, G-force, Stats, history,
settings and transition UI; nationwide aircraft support; the v1/v2 receiver;
and the tested v3 aircraft field-delta codec and automatic format negotiation.
The regular app contains neither the OOS Test banner nor its local Mac feed.

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
build number 145 does not set the Android version code. This snapshot has not
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
in `.local/appstore-1.0.2-145/` on the Mac that built it.
