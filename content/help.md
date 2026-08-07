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

The [Aircraft](/aircraft) page lists every tracked aircraft, including its tail,
operator, model, role, base, home state, current state, status, and last
observation. Catalog records and changes are stored in Supabase.

## Notifications

Enable alerts in [Settings → Alerts](/settings/alerts). The subscription follows
the state selected on that screen. When a tracked aircraft in that state has a
confirmed takeoff, the notification worker queues one delivery for the device.

On iOS, Web Push requires installing the site to the home screen and opening it
from there before granting permission.

## Flight time and fuel

Out Of Sight creates an active flight session when an aircraft transitions from
grounded to airborne. The session powers the flight clock, live position,
speed, direction, and estimated fuel remaining. After landing is confirmed, the
active-flight track is cleared and the session is finalized so the next flight
starts fresh. Fuel remaining is an estimate based on elapsed flight time and
the aircraft performance profile; it is not telemetry from the aircraft.

## Privacy and limitations

The server stores aircraft observations, catalog data, state-level push
subscriptions, and notification delivery history. It does not store a rider's
live location. Browser location used for ride tools stays on the device.

ADS-B reception can be delayed, incomplete, blocked, or absent. Do not use the
site for navigation, collision avoidance, emergency response, or evading law
enforcement.
