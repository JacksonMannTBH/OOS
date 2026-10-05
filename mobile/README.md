# Out Of Sight for Android (Capacitor)

This directory contains the Capacitor Android project. The existing Bubblewrap/TWA
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

The shell connects to the production Next.js app and uses native Capacitor
plugins for Android permissions and Firebase notifications. After Firebase and
the backend environment are configured, run `npm run build:bundle`; it prompts
for the existing upload-key password without printing it and writes
`mobile/android/out-of-sight-capacitor-release.aab`.
