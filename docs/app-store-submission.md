# Out Of Sight App Store submission draft

Apple enrollment is active per the owner's October 9, 2026 update. The
listing below describes the core aircraft experience. Upload must wait for a
tested iPhone build, active signing, notification configuration, and deployment
of the matching website changes. Nothing in this draft has been submitted.

## Listing fields

| Field | Draft value |
| --- | --- |
| Name | Out Of Sight |
| Subtitle | Public safety aircraft tracker |
| Primary language | English US |
| Bundle ID | live.outofsight.app |
| Version | 1.0 |
| Build | 1; increment for later uploads |
| Suggested SKU | oos-iphone-001 |
| Suggested category | Reference |
| Support URL | https://outofsight.live/help |
| Privacy URL | https://outofsight.live/legal#privacy |
| Marketing URL | https://outofsight.live |
| Suggested release setting | Manual release after approval |

Confirm name availability, category, copyright ownership, pricing, distribution
regions, age-rating answers, and the review contact before creating the final
record. The URLs need a live check after deployment. Apple's [app information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
and [version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
describe the fields and their limits.

### Promotional text

Explore public-safety aircraft by state, follow available flight paths, and view aircraft details with a focused map and Ride Mode.

### Keywords

aviation,helicopter,plane,flight,radar,ADS-B,police,emergency,map,tracking

### Description

Explore law-enforcement and public-safety aircraft activity across the United States with Out Of Sight.

Choose a state to focus the map and tracked aircraft list. Browse aircraft profiles, see available positions and flight paths, and adjust which aircraft appear in your view.

Ride Mode brings nearby aircraft information into a focused display with distance, direction, and speed when location is available. Customize distance bands, time format, contrast, and screen-wake behavior in Settings.

Aircraft data comes from public observations. Coverage and freshness vary, and an aircraft may be missing or its position delayed. An internet connection is required for live information. Location permission is optional and is used for features that depend on your position.

Out Of Sight is an independent project and is not affiliated with a government agency or aircraft operator. It is for informational use, not navigation, emergency response, or collision avoidance. Use the app only when it is safe to do so.

### Notification copy after validation

Add this paragraph to the description only after physical-device push tests pass:

Enable optional takeoff notifications for tracked aircraft in your selected state. Adjust your aircraft selections and turn alerts off at any time in Settings.

## Reviewer notes draft

The main aircraft features do not require an account. Start at Home, open Map,
and choose a state. Settings provides the tracked aircraft catalog, display
preferences, Help & support, and Legal & privacy.

Aircraft observations depend on third-party coverage and actual flight activity.
A state may have no currently airborne aircraft. The catalog remains available
to browse. Location permission is optional; allowing it enables position,
distance, speed, and Ride Mode features. Ride Mode includes an optional
screen-wake setting and a user-started Live tracking session on iOS 16.2+.
Live tracking uses background location to calculate aircraft distances on the
device while another app is open or the phone is locked. It does not request
Always location authorization. Stop live tracking or End Ride ends the session.
The activity shows the nearest tracked airborne aircraft in the selected state,
distance in nautical miles, and Stop/Warning/Watch/Clear using the user's Ride
Mode thresholds. Expired location or aircraft data does not display a fresh
Clear state. Tap the activity to reopen Ride Mode.

The iPhone app uses Capacitor with hosted content at https://outofsight.live,
native location access, native screen-wake support, and a WidgetKit Live Activity.
Live content requires
connectivity. A bundled connection screen handles an initial loading failure.

After notification configuration and testing are complete, include these steps:
Open Settings → Notifications & state, select a state, turn notifications on,
and allow the iPhone prompt. Use Send test notification to verify delivery.

Before submission, replace conditional instructions with the tested build's
final behavior and supply a monitored review-contact email and phone number.
Do not claim that notifications work until their complete delivery path passes.

## Screenshots to capture

Capture the actual tested iPhone app: Home, Map with aircraft details, the
aircraft catalog, Ride Mode, and notification preferences. Use a clear example
state and remove incidental personal location from marketing captures. Do not
present mock aircraft positions as current real observations. Existing Android
artwork is not a substitute for iPhone screenshots. Confirm the required device
sizes in [Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## Privacy answers to finish

Use this inventory to complete the App Store privacy questionnaire after checking
the deployed services and final archive. These are not submitted privacy answers.
Apple requires consideration of data collected by partners and through the app's
web content, not just native code. [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)

| Data path | Current implementation | Remaining check |
| --- | --- | --- |
| Location and heading | Map, Ride, and opt-in background Live tracking calculations occur on device; native aircraft requests contain only state and cache timestamp | Confirm outgoing requests, including map tiles, and provider retention |
| Notifications | Random device ID, selected state, aircraft preferences, and FCM token are sent to the subscription service | Identify applicable identifier and usage categories, purposes, linkage, and provider practices |
| Preferences | Stored locally; alert selections also sync to the server when alerts are enabled | Distinguish local-only preferences from uploaded choices |
| Technical requests | Hosting, database, map, and push services process request data | Review retained IP addresses, diagnostics, SDK manifests, and provider settings |

Do not select “Data Not Collected” or finalize tracking/linkage answers from the
location behavior alone. Check the entire configured app and its partners.

## Release findings

- The website changes were published on October 9, 2026 in commit
  `2463c10a1e47288fccd67ee90b7e791fa9e3d351`, Netlify deploy
  `6ac90785d2d2e70008af2944`. The client now supports native iPhone push and
  suppresses the Home Screen install banner inside iOS. Alert controls check
  iPhone build readiness as well as server
  readiness, and automatic promotions are suppressed when alerts cannot be
  enabled. The signed app includes the notification-readiness plugin, and the
  Firebase relay update was deployed on October 9. The APNs connection and
  actual push delivery remain pending.
  This setup is separate from the Live tracking location session.
- The local Help page now has a support contact, separate native and browser
  notification instructions, and a location summary covering on-device use and map requests.
  Both public Help and Legal URLs returned HTTP 200 on October 9, 2026. The
  published Help page includes the contact link and Live Tracking instructions.
- Listing text is within the current limits: name 12 characters, subtitle 30,
  promotional text 131, description 1015, and keywords 74 UTF-8 bytes. The icon
  is 1024 by 1024 pixels without an alpha channel. The matching iPhone Firebase
  configuration was installed on October 8, 2026; the local release configuration
  check now passes. Firebase's iPhone app has no APNs key or certificate, Apple
  enrollment is now active per the owner's October 9 update; Xcode is signed in
  and the Apple Development certificate is installed. Team `C6S63TAR8C` is configured on
  both targets for Debug and Release. The unsigned Release build passed. The owner's
  iPhone now has Developer Mode enabled. The signed development build is installed
  and launched, and the owner confirmed Home loads normally. The signed Release
  archive and local App Store export passed. Both exported targets have verified
  signatures and App Store profiles, matching Team/version/build, and debugging
  disabled; the app has the production APNs entitlement. No upload has occurred.
  The Firebase relay update deployed successfully; its existing URL and Cloud
  Run URL reject unauthenticated requests. Physical-iPhone delivery testing
  remains unfinished.
- Spot reporting has been removed from the app, API, and admin navigation. The
  historical database migrations and seven-day cleanup remain intact for older
  records; no production database data was deleted. The removed live `/api/spot`
  endpoint returned 404 after deployment.
- Live tracking is implemented as an opt-in native location session and
  WidgetKit Live Activity, independent of takeoff-alert push delivery. The button,
  privacy text, and help content are published; both the app and widget are
  included in the signed iPhone build. Before listing the feature,
  verify start/stop, updates while another app is open and while locked, stale
  data, permission denial, system dismissal, and the Ride Mode deep link on a
  physical device. Native calculation checks and builds do not verify those
  system behaviors.
- The Settings Store link opens an apparel gallery labeled “Coming soon.”
  Finish that experience or remove the unfinished entry from the release before
  submission; do not advertise purchasing while no checkout exists.
- The iPhone shell loads hosted web content. Demonstrate the tested map,
  location, Ride Mode, and notification utility in review. Approval is still
  subject to Apple's minimum-functionality assessment.
- Verify permission to distribute each aircraft-data source and map asset in the
  intended regions. Public availability alone is not proof of redistribution rights.

These checks relate to Apple's [review guidelines](https://developer.apple.com/app-store/review/guidelines/),
particularly app completeness, minimum functionality, and third-party content.
Device testing and the operational release checklist are in [the mobile README](../mobile/README.md).
