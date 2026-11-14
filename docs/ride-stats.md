# All-time ride stats

Settings → Stats is a separate menu group above Notifications & state. It shows top speed, longest distance, longest duration, and completed ride count for this device.

`RideLifetimeStats` is stored atomically alongside ride history. Completing a ride or recovering an interrupted ride updates the aggregates before the recent-summary list is trimmed to three. Deleting summaries and resetting display preferences leave the aggregates intact. Active rides are excluded until completed. Retrying End or interrupted recovery does not count the ride twice. Missing GPS remains an unknown speed/distance rather than an invented zero.

Existing archives decode without the new optional field. The recorder seeds it once from the completed summaries still present, then saves the migration before reporting status. Already deleted or expired summaries cannot be recovered. Storage remains local to this device; reinstalling the app removes its local records.

Native regression checks:

```sh
swiftc mobile/ios/App/Shared/RideMotion.swift mobile/ios/App/Shared/RideHistory.swift mobile/ios/Tests/RideHistoryTests.swift -o /tmp/oos-ride-history-tests
/tmp/oos-ride-history-tests
```
