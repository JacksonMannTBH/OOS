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

## Live tracking on iPhone

On Home, tap the small **Live** button in the top-left corner to show the nearest
tracked airborne aircraft, distance in nautical miles, and ride state on the Lock Screen and in
the Dynamic Island on supported iPhones. It uses your selected state's aircraft
and the Stop, Warning, Watch, and Clear distance settings from Ride Mode.

Location access continues during this session while you use other apps or lock
the phone. Distances are calculated on your device; aircraft-data requests do
not include your coordinates. Tap **Live** again on Home to stop the session.
Live tracking continues when you leave or end Ride Mode. Tap the Live Activity
to reopen Home.

Live tracking requires iOS 16.2 or later, location permission, and Live Activities
enabled for OOS in iPhone Settings. If data becomes outdated, the display shows
**Updates paused** or an unavailable-data message instead of a current ride
state. Connectivity, location availability, and iOS background limits affect
updates. Force-quitting OOS stops updating; reopen it to start a new session.
Apple ends a Live Activity after at most eight hours. This feature is separate
from takeoff notifications.

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
subscriptions, and notification delivery history. It does not store a rider's
continuous live location. Location used for map positioning and Ride Mode is
processed on the device. Map providers receive requests for the area you view.
Read [Legal & privacy](/legal#privacy) for details about alerts, provider requests,
retention, and deletion.

ADS-B reception can be delayed, incomplete, blocked, or absent. Do not use the
site for navigation, collision avoidance, emergency response, or evading law
enforcement.

## Contact support

For help, bug reports, or feature requests, email
[jacksonmann253@gmail.com](mailto:jacksonmann253@gmail.com).
Include your device model, app version if available, and the steps that led to
the issue. For privacy or deletion requests, use the same address and see
[Legal & privacy](/legal#privacy).
