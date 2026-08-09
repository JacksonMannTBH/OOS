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
details. Catalog records and changes are stored in Supabase.

## Notifications

Enable alerts in [Settings → Alerts](/settings/alerts). The subscription follows
the state selected on that screen. When a tracked aircraft in that state has a
confirmed takeoff, the notification worker queues one delivery for the device.

On iOS, Web Push requires installing the site to the home screen and opening it
from there before granting permission.

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
live location. Browser location used for ride tools stays on the device.

ADS-B reception can be delayed, incomplete, blocked, or absent. Do not use the
site for navigation, collision avoidance, emergency response, or evading law
enforcement.
