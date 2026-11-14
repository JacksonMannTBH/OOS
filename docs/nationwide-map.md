# Nationwide map preference

Settings → Notifications & state has a **Nationwide map** card above Takeoff
notifications. **Show aircraft from all states** defaults off and is saved in
the device-preferences snapshot as `oos_nationwide_map_enabled`.

When enabled, only the full map's markers use nationwide OOS-tracked flights.
This includes the full tracked catalog, independently of per-state notification
exclusions and California's regional selection. Home (including its map preview),
the map header, Ride Mode, app status/eye indicators, and push subscriptions keep
using the existing selected-state feed and preferences. Changing this setting
never changes the selected state or enrolls/updates a push subscription.

`GET /api/map-aircraft` reads the existing public aircraft view for reported
flights in all states, with pagination and the same observation mapping as the
state-scoped endpoint. The native `oos-app/map-aircraft` route keeps the existing
publishable-key authentication and CORS policy. No new schema, provider request,
ingestion worker deployment, scheduler change, or notification worker change is
needed.

The full map refreshes nationwide markers every 15 seconds while enabled and
foregrounded. Reads abort on disable, navigation, backgrounding, or going offline;
late responses cannot restore disabled markers. Newer observations win when
both feeds contain an aircraft, including newer state-feed landings. Existing aging
rules apply. Failures retain the last usable readings and show an update message.

Selected out-of-state flights can use their own state channel for flight paths.
With all flight paths enabled, only states represented by visible flights are
subscribed, with staggered joins. These read-only subscriptions never affect
which state supplies the header or notifications.

## Native API release

On November 13, 2026, `oos-app` version 14 added only the map endpoint and its
snapshot scope helper. The release was applied to the live version 13 bundle,
preserving unrelated differences between the local checkout and the deployed
API. Authentication, state-scoped reads, provider attribution, and notification
handlers were preserved. The prepared delta, release smoke test, and live
read/auth checks are under `.local/nationwide-map-125/`.
