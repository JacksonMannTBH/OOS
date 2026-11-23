# Out Of Sight help

Out Of Sight is a situational-awareness tool that shows tracked public-safety
aircraft using public ADS-B observations.

## Choose a state

Use the state selector on the Map or Alerts screen. The selected state controls
which aircraft appear and which takeoff notifications the device receives.
There are no sub-state notification groups.

## Map and flight paths

The Map refreshes aircraft data every 30 seconds. A line connects each retained
coordinate for the active flight. When landing is confirmed, the flight and its
coordinates are cleared from the active view.

## Aircraft catalog

The [Aircraft](/aircraft) page lists every tracked aircraft by home state,
including its tail, operator, model, and estimated endurance. Open an aircraft
profile for its role, base, current status, latest track, and retained flight
details.

## Notifications

Enable alerts in [Settings → Alerts](/settings/alerts). The subscription follows
the state selected on that screen. When a tracked aircraft in that state has a
confirmed takeoff, the notification worker queues one delivery for the device.

In the iPhone app, enable notifications from that screen and accept the iPhone
permission prompt. If permission was denied, open iPhone Settings → Notifications
→ Out Of Sight, allow notifications, then return to the app and try again.

If you use the website in Safari instead, Web Push requires installing the site
to the Home Screen and opening it from there before granting permission.

## Ride Mode and location

Location places you on the map and supplies distances and speed in Ride Mode.
If you decline location access, your position and location-based distances are
unavailable. You can still browse aircraft information and choose a state.

Use [Settings → Ride mode & display](/settings/display) to change distance bands
or turn “Keep the screen awake” on or off. Wake mode applies while Ride Mode is
open. Use **Show speedometer** in these settings to show or hide your MPH
speedometer in Ride Mode. End Ride restores normal screen sleep. Screen-wake
support varies by browser and device.

Tap **Distance colors** in the same settings to preview and choose a palette.
Each preview shows the four distance colors. The palette applies to
distance indicators in Home, Ride Mode, Live Activities, and CarPlay. Color Mode
controls the app's accent separately; choosing a palette keeps your distance
bands unchanged.

On iPhone, **Start Ride** records top speed, estimated distance in miles, and
duration after you confirm recording and allow Precise Location. Recording
continues while the screen is locked or you use another app. **Resume Ride**
returns to the same active ride. **End Ride** saves it and opens its summary.
Your three latest completed rides appear on Home; tap a row to review
it. Older summaries are replaced when you complete another ride.

Ride summaries and route points stay on this phone and are excluded from iCloud
backup. The summary map shows the recorded route, start, and finish. Route history
is not uploaded. GPS spikes and poor readings are filtered, so top
recorded speed and distance are estimates. If GPS is lost, missing distance is
not filled in. Force-quitting or restarting the app preserves the last saved
portion as an interrupted ride; it does not silently start recording again.
Ride recording works independently of aircraft Live Tracking. Stop each session
to end its background location use. Ride recording does not require internet;
aircraft data and map tiles still do.

<!-- membership-preview:start -->
Elite members can choose a username and icon in **Elite Settings**, then enable
**Visible to other riders** to appear on other users’ maps during a recorded
ride. Confirming visibility shares your precise current location, including
while the screen is locked. **Share current speed** separately controls whether
other riders can see your MPH. End Ride or turning visibility off removes your
marker. If your connection is lost, the marker disappears within 45 seconds.
Your profile belongs to this installation, with no login, recovery or transfer.
<!-- membership-preview:end -->

Choose **G-force**, **Lean arc**, or **Moving horizon** under **Settings → Ride mode & display →
Swipe gauge**. Tap the Swipe gauge row to see previews and descriptions,
then choose a gauge; a checkmark identifies your current choice. Swipe the
ride map to open your chosen gauge; swipe again to
return to the map. G-force is the default. The **Stats** button opens ride statistics from either view, and its map
button returns to the map. Peak acceleration, braking, and left/right
cornering G appear inside the G-force circle and in saved ride summaries.
The meter shows movement G,
approximately **0 G at rest**, with a dot indicating acceleration direction.
Completed ride summaries retain these peaks locally.

The **Lean arc** shows your current lean angle and whether you are leaning
left or right, using your selected color mode. Its arc spans 60° each way; the
number continues to show the full angle beyond that scale. Maximum left and
right lean appear below when Lean and Pitch recording is enabled. The reset
button clears angle peaks, including pitch, without changing calibration.

The **Moving horizon** shows estimated pitch with a large, signed degree
reading. Its center marker stays fixed while the level reference moves. A
negative value means downward pitch. **MAX PITCH** uses your recorded angle
peak; resetting it also clears the left/right lean peaks. It follows your
selected color mode and works with Lean and Pitch recording turned off.

Secure your phone in portrait, facing you and aligned with the bike. Tap the
calibration button beside Home for each ride. It blinks until readings settle
briefly; gentle movement is allowed. For the best reference, keep the bike
upright and stop on level ground. Calibrating while leaned or on a slope can
offset the readings. Calibrate again after moving the phone. The same control calibrates Lean and
Pitch when enabled; all live gauges work with angle recording turned off. Motion
recording pauses when the phone is locked or OOS is in the background, while
GPS ride recording continues.

## Police sightings

The police button in Ride Mode lets you report police you see on the road. The
first tap explains the feature; **Got it** closes that explanation without
submitting a report. Tap again when you want to report.

Within a quarter mile of an existing sighting, the button asks **Are police
still here?** Choose **Still Here** or **Not Seen**, or close it without voting.
Each phone counts once per sighting. The original report counts as Still Here;
twice as many Not Seen votes remove the sighting. A new Still Here confirmation
refreshes its 30-minute expiry. Not Seen does not extend it.

Maps show active sightings in your selected state. In Ride Mode, **POLICE
NEARBY** appears within one mile. Tap a police icon on the main map for its
report count and age. Checking or reporting requires internet and a precise
location; no route history is uploaded.

## Live tracking on iPhone

On Home, tap the small **Start Live Tracking** button in the top-left corner to show the nearest
tracked airborne aircraft, distance in nautical miles, and ride state on the Lock Screen and in
the Dynamic Island on supported iPhones. It uses your selected state's aircraft
and the Stop, Warning, Watch, and Clear distance settings from Ride Mode.

Location access continues during this session while you use other apps or lock
the phone. Distances are calculated on your device; aircraft-data requests do
not include your coordinates. Tap **Stop Live Tracking** on Home to stop the session.
Live tracking continues when you leave or end Ride Mode. Tap the Live Activity
to reopen Home.

Live tracking requires iOS 16.2 or later, location permission, and Live Activities
enabled for OOS in iPhone Settings. The Live Activity appears after the first
known aircraft state. Its color follows your selected Distance colors palette.
Classic uses green for Clear, blue for Watch, amber for Warning, and red for Stop.
If updates pause, it keeps
the last available state, aircraft, and distance; the Updated time shows when
that result was recorded. Connectivity, location availability, and iOS background limits affect
updates. Force-quitting OOS stops updating; reopen it to start a new session.
Apple ends a Live Activity after at most eight hours. This feature is separate
from takeoff notifications.

## CarPlay

On an iPhone running iOS 26 or later, Live Tracking can appear as a compact card
in CarPlay Dashboard.

1. Before driving, open OOS on your iPhone and tap **Start Live Tracking** on Home.
   Allow location access and enable Live Activities for OOS in iPhone Settings
   if needed.
2. Connect your iPhone to CarPlay and open Dashboard. CarPlay controls whether
   and where the Live Activity appears.
3. To end the session, tap **Stop Live Tracking** on Home on your iPhone.

The card shows the nearest tracked airborne aircraft in your selected state,
its proximity status, distance in nautical miles, compass direction from you,
aircraft label, and last-update time. It follows the same distance bands as
Live Tracking on your iPhone. If updates pause, the last-update time identifies
the retained reading.

Start, stop, and settings controls stay on your iPhone. The CarPlay card is
read-only and does not include a map. Starting or ending Ride Mode is separate
from Live Tracking; end each session on your iPhone when finished. If the card
is missing, check that Live Tracking is active and Live Activities are enabled
for OOS on your iPhone. CarPlay visibility settings and Focus can affect whether
it appears.

## Flight time and fuel

Out Of Sight creates an active flight session after two consistent airborne
observations. A precise takeoff time and endurance countdown are shown only
when a recent grounded observation provides a reliable transition boundary.
If tracking begins while the aircraft is already airborne, the takeoff time and
countdown remain unavailable. After two grounded observations confirm landing,
the active-flight track is cleared and the session is finalized.

The displayed endurance is a catalog upper bound minus exact elapsed flight
time. It assumes the published maximum-duration profile; it is not remaining
fuel, fuel quantity, reserve planning, or telemetry from the aircraft.

## Privacy and limitations

The server stores aircraft observations, catalog data, state-level push
subscriptions, and notification delivery history. <!-- membership-preview:start -->With Elite rider sharing
enabled, it also stores your rider profile and latest shared position during
an active ride. It does not store a history of shared positions. <!-- membership-preview:end -->Other map and
Ride Mode location calculations happen on your device. Map providers receive requests for the area you view.
If no state has been selected, the map sends one location fix through our server
to the U.S. Census geocoder to identify the state.
Read [Legal & privacy](/legal#privacy) for details about alerts, provider requests,
retention, and deletion.

ADS-B reception can be delayed, incomplete, blocked, or absent. Do not use the
site for navigation, collision avoidance, emergency response, or evading law
enforcement.

## Contact support

For help, bug reports, or feature requests, email
[localbusinessforms@outlook.com](mailto:localbusinessforms@outlook.com).
Include your device model, app version if available, and the steps that led to
the issue. For privacy or deletion requests, use the same address and see
[Legal & privacy](/legal#privacy).
