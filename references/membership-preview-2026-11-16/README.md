# Saved membership preview before App Store build 192

Saved November 16, 2026. The source archive contains the complete Pro/Elite UI,
pop-up dialogs, badges, Elite settings, rider-sharing implementation, tests,
and integration code as it existed before the build 192 release exclusions.
The latest ride and Live Activity fixes are included in the snapshot.

`source-manifest.json` records the SHA-256 of every archived file. All 470 files
were read back from `source-before-build-192.tar.gz` and verified after saving.
Extract into a separate folder for comparison; do not overwrite newer work.

## Current source and future restoration

The membership implementation remains in its original source files. Normal
mobile builds now substitute release adapters and omit Elite routes, membership
screens, purchase prompts, tier badges, and rider-sharing modules. Existing
Ride Mode, statistics, alerts, aircraft paths and Live Tracking remain available.

Use `npm run build:web:membership-preview` or
`npm run sync:ios:membership-preview` from `mobile/` for a deliberate development
preview. Use an iPhone Debug build for the existing native plan controls.
The release checker rejects a membership-preview interface for App Store upload.

Relevant files: `mobile/vite.config.ts`, `lib/membership-availability.ts`,
`components/ProAccess.tsx`, `mobile/frontend/Settings.tsx`,
`mobile/frontend/Elite.tsx`, `components/EliteSettings.tsx`,
`lib/pro-access.ts`, `mobile/ios/App/App/ProSubscriptionPlugin.swift`,
and `mobile/ios/App/App/RiderSharingPlugin.swift`.

For a future public membership release, complete the intended billing and
entitlement work, explicitly enable the release features, and update the release
checker. Do not restore the archived Xcode project or shared app files wholesale;
merge only the relevant membership changes so later fixes are preserved.
