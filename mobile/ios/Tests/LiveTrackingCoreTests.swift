import Foundation

@main
enum LiveTrackingCoreTests {
    static func main() throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let config = RideTrackingConfiguration(stateCode: "WA", stateName: "Washington",
            excludedTails: [], watchNm: 10, warningNm: 5, stopNm: 2)
        var passed = 0
        func check(_ title: String, _ body: () throws -> Void) rethrows {
            try body()
            passed += 1
            print("PASS \(title)")
        }
        func require(_ condition: Bool, _ message: String) {
            precondition(condition, message)
        }
        func plane(_ tail: String = "N123", latitude: Double? = 0.01,
                   longitude: Double? = 0,
                   airborne: Bool = true, age: Double = 0,
                   timestamp: Bool = true) -> RideTrackingAircraft {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return RideTrackingAircraft(tail: tail, model: "Cessna", nickname: nil,
                airborne: airborne, lat: latitude, lon: longitude,
                position_observed_at: timestamp ? formatter.string(from: now.addingTimeInterval(-age)) : nil,
                last_seen_min: timestamp ? nil : age / 60)
        }
        func snapshot(_ planes: [RideTrackingAircraft], age: Double = 0,
                      ok: Bool? = true, source: String = "adsbfi") -> RideTrackingSnapshot {
            RideTrackingSnapshot(fetched_at: now.addingTimeInterval(-age).timeIntervalSince1970 * 1000,
                source_ok: ok, source: source, aircraft: planes)
        }
        func summary(_ feed: RideTrackingSnapshot?, locationAge: Double = 0,
                     configuration: RideTrackingConfiguration? = nil) -> RideTrackingContent {
            RideTrackingCalculator.summarize(snapshot: feed, lat: 0, lon: 0,
                locationDate: now.addingTimeInterval(-locationAge), configuration: configuration ?? config, now: now)
        }

        check("Stop, Warning, Watch, and Clear honor inclusive distance boundaries") {
            require(config.label(distanceNm: 2) == "Stop", "Stop boundary")
            require(config.label(distanceNm: 2.01) == "Warning", "Warning band")
            require(config.label(distanceNm: 5) == "Warning", "Warning boundary")
            require(config.label(distanceNm: 5.01) == "Watch", "Watch band")
            require(config.label(distanceNm: 10) == "Watch", "Watch boundary")
            require(config.label(distanceNm: 10.01) == "Clear", "Clear band")
            var custom = config
            custom.stopNm = 1; custom.warningNm = 3; custom.watchNm = 8
            require(custom.label(distanceNm: 2) == "Warning", "Custom distances must apply")
        }
        check("nearest aircraft is selected by distance, ignoring grounded aircraft") {
            let result = summary(snapshot([plane("FAR", latitude: 0.1), plane("GROUND", latitude: 0, airborne: false), plane("NEAR")]))
            require(result.aircraft == "Plane NEAR", "Must select nearest airborne contact")
            require(abs((result.distanceNm ?? 0) - 0.6004) < 0.002, "Must calculate nautical miles")
            require(result.rideState == "Stop", "Nearest contact should determine status")
            require(result.direction == "N", "Direction must belong to the nearest contact")
        }
        check("aircraft exclusions apply before choosing nearest") {
            var selected = config
            selected.excludedTails = ["N123"]
            let result = summary(snapshot([plane(), plane("OTHER", latitude: 0.1)]), configuration: selected)
            require(result.aircraft == "Plane OTHER" && result.rideState == "Watch", "Excluded aircraft cannot determine state")
        }
        check("healthy empty feed can show Clear without inventing a distance") {
            let result = summary(snapshot([]))
            require(result.rideState == "Clear" && result.distanceNm == nil, "No artificial zero-distance aircraft")
        }
        check("the map's four-minute report timeout clears a retained aircraft at the boundary") {
            let previous = summary(snapshot([plane()]))
            require(summary(snapshot([plane(age: 239.999)])).rideState == "Updating",
                    "A stale position before four minutes is unavailable, not landed")
            let landed = summary(snapshot([plane(age: 240)]))
            require(landed.rideState == "Clear" && landed.aircraft == "No tracked aircraft airborne",
                    "Four minutes without a report must match the map's landed state")
            require(landed.aircraftTail == nil && landed.distanceNm == nil && landed.direction == nil,
                    "Landing must remove the previous aircraft, distance and arrow")
            require(RideTrackingCalculator.displayedContent(landed, previous: previous) == landed,
                    "The landing must replace the retained aircraft")
        }
        check("confirmed landings and empty skies can publish without a fresh rider location") {
            let previous = summary(snapshot([plane()]))
            for feed in [snapshot([]), snapshot([plane(airborne: false)]), snapshot([plane(age: 300)])] {
                for locationAge in [31.0, 3600.0] {
                    let result = summary(feed, locationAge: locationAge)
                    require(result.rideState == "Clear" && result.updatedAt == now,
                            "The feed proves there are no airborne contacts without GPS")
                    require(RideTrackingCalculator.displayedContent(result, previous: previous) == result,
                            "Old GPS must not block a landing update")
                }
                let result = RideTrackingCalculator.summarize(snapshot: feed, lat: nil, lon: nil,
                    locationDate: nil, configuration: config, now: now)
                require(result.rideState == "Clear", "No distance calculation is needed without aircraft")
            }
        }
        check("individual report times take priority over newer fleet and position timestamps") {
            var old = plane()
            old.observed_at = ISO8601DateFormatter().string(from: now.addingTimeInterval(-300))
            require(summary(snapshot([old])).rideState == "Clear",
                    "New fleet data or coordinates cannot refresh an old individual report")
            var reported = plane(age: 300)
            reported.observed_at = ISO8601DateFormatter().string(from: now.addingTimeInterval(-10))
            require(summary(snapshot([reported])).rideState == "Updating",
                    "A recent aircraft report with stale coordinates must not claim landing")
            var resumed = plane()
            resumed.observed_at = ISO8601DateFormatter().string(from: now)
            require(summary(snapshot([resumed])).rideState == "Stop", "A new report restores airborne tracking")
        }
        check("landing the previous contact selects another airborne aircraft when available") {
            let previous = summary(snapshot([plane("LANDED")]))
            let result = summary(snapshot([plane("LANDED", airborne: false), plane("NEXT", latitude: 0.1)]))
            require(result.aircraftTail == "NEXT" && result.rideState == "Watch", "Select the remaining aircraft")
            require(RideTrackingCalculator.displayedContent(result, previous: previous) == result,
                    "The new contact must replace the landed one")
            require(summary(snapshot([plane(age: 300), plane("NEXT", latitude: 0.1)])).aircraftTail == "NEXT",
                    "A timed-out contact must not block the next one")
            require(summary(snapshot([plane(age: 300), plane("NEXT", latitude: 0.1)]), locationAge: 31).rideState == "Updating",
                    "Remaining airborne contacts still require current rider coordinates")
        }
        try check("API report fields decode and explicitly unobserved contacts match the map") {
            let data = try JSONSerialization.data(withJSONObject: [
                "tail": "N123", "model": "Cessna", "airborne": true,
                "lat": 0.01, "lon": 0, "last_seen_min": 0,
                "observed_at": ISO8601DateFormatter().string(from: now.addingTimeInterval(-300)),
                "observed": true
            ])
            var aircraft = try JSONDecoder().decode(RideTrackingAircraft.self, from: data)
            require(aircraft.observed == true && aircraft.observed_at != nil, "Read the map's report metadata")
            require(summary(snapshot([aircraft])).rideState == "Clear", "Decoded report time controls the timeout")
            aircraft.observed_at = ISO8601DateFormatter().string(from: now)
            aircraft.observed = false
            require(summary(snapshot([aircraft])).rideState == "Clear", "Unobserved contacts are hidden on the map")
            aircraft.observed = true
            aircraft.observed_at = "invalid timestamp"
            require(summary(snapshot([aircraft])).rideState == "Stop", "Malformed report time cannot invent landing")
        }
        check("expired location cannot show a current ride state") {
            let result = summary(snapshot([plane()]), locationAge: 31)
            require(result.rideState == "Updating" && result.distanceNm == nil, "Stale rider location")
        }
        check("old or future-dated feed cannot show Clear") {
            require(summary(snapshot([], age: 46)).rideState == "Updating", "Old feed")
            require(summary(snapshot([], age: -60)).rideState == "Updating", "Invalid future date")
        }
        check("failed, missing, and mock feeds cannot show Clear") {
            require(summary(nil).rideState == "Updating", "Missing feed")
            require(summary(snapshot([], ok: false)).rideState == "Updating", "Failed provider")
            require(summary(snapshot([], source: "mock")).rideState == "Updating", "Mock feed")
        }
        check("fresh HTTP response cannot revive stale aircraft coordinates") {
            let result = summary(snapshot([plane(age: 91)]))
            require(result.rideState == "Updating", "Position time must be checked separately")
        }
        check("unlocated aircraft cannot invent Clear or block located aircraft") {
            require(summary(snapshot([plane(latitude: nil)])).rideState == "Updating", "Missing aircraft position")
            let located = summary(snapshot([plane("VALID"), plane("UNKNOWN", latitude: nil)]))
            require(located.rideState == "Stop" && located.aircraftTail == "VALID", "Use the nearest aircraft with a usable position")
            let expired = summary(snapshot([plane("OLD", latitude: 0, age: 91), plane("VALID", latitude: 0.1)]))
            require(expired.rideState == "Watch" && expired.aircraftTail == "VALID", "An expired contact must not block a current one")
        }
        check("fallback position age is relative to feed time, not request completion") {
            let result = summary(snapshot([plane(age: 60, timestamp: false)], age: 20))
            require(result.rideState == "Stop", "Recent fallback age should work")
            require(abs(result.validUntil.timeIntervalSince(now) - 10) < 0.01, "Only ten seconds of position validity remain")
            require(summary(snapshot([plane(age: 90, timestamp: false)], age: 20)).rideState == "Updating", "Already stale fallback age must be unavailable")
        }
        check("missing position age is unavailable even with valid coordinates") {
            let unknown = RideTrackingAircraft(tail: "N123", model: "Cessna", nickname: nil,
                airborne: true, lat: 0.01, lon: 0, position_observed_at: nil, last_seen_min: nil)
            require(summary(snapshot([unknown])).rideState == "Updating", "Position freshness cannot be invented")
        }
        check("stale date expires with earliest rider, feed, or aircraft deadline") {
            let result = summary(snapshot([plane()], age: 40), locationAge: 20)
            require(abs(result.validUntil.timeIntervalSince(now) - 5) < 0.01, "Feed expires first")
        }
        check("invalid rider coordinates cannot claim Clear") {
            let result = RideTrackingCalculator.summarize(snapshot: snapshot([plane()]), lat: .nan, lon: 0,
                locationDate: now, configuration: config, now: now)
            require(result.rideState == "Updating", "Invalid location")
        }
        try check("first use has no starting text or invented aircraft state") {
            let initial = RideTrackingContent.initial(stateName: config.stateName, now: now)
            require(initial.rideState.isEmpty && initial.message.isEmpty && !initial.hasKnownRideState, "No starting or unavailable-data copy")
            require(initial.distanceNm == nil && initial.aircraftTail == nil, "No invented aircraft or distance")
            require(initial.stateName == config.stateName, "Initial activity identifies the selected region")
            let restored = try JSONDecoder().decode(RideTrackingContent.self, from: JSONEncoder().encode(initial))
            require(restored == initial, "Widget and recovery preserve neutral first-use content")
            require(RideTrackingCalculator.displayedContent(summary(nil), previous: restored) == nil,
                    "Missing data does not invent a measured state")
        }
        check("restart immediately restores the complete previous state, even after its deadline") {
            for fresh in [summary(snapshot([])), summary(snapshot([plane()])),
                          summary(snapshot([plane(latitude: 0.05)])), summary(snapshot([plane(latitude: 0.1)]))] {
                let restored = RideTrackingContent.initial(stateName: config.stateName, previous: fresh,
                    now: now.addingTimeInterval(3600))
                require(restored == fresh, "Keep the state, aircraft, distance and observation timestamp")
            }
            let unknown = RideTrackingContent.waiting("Waiting for location", now: now)
            require(RideTrackingContent.initial(stateName: config.stateName, previous: unknown).message.isEmpty,
                    "An unavailable placeholder is never restored as a result")
        }
        check("first valid result replaces empty content and later missing updates retain it") {
            let initial = RideTrackingContent.initial(stateName: config.stateName, now: now)
            for fresh in [summary(snapshot([])), summary(snapshot([plane()])),
                          summary(snapshot([plane(latitude: 0.05)])), summary(snapshot([plane(latitude: 0.1)]))] {
                let displayed = RideTrackingCalculator.displayedContent(fresh, previous: initial)
                require(displayed == fresh && displayed?.hasKnownRideState == true, "First known result appears")
                for unavailable in [summary(nil), summary(snapshot([], age: 46)),
                                    summary(snapshot([plane()]), locationAge: 31),
                                    summary(snapshot([], ok: false))] {
                    let retained = RideTrackingCalculator.displayedContent(unavailable, previous: displayed)
                    require(retained == fresh && retained?.hasKnownRideState == true,
                            "Stale or failed data retains the result and its original timestamp")
                }
            }
        }
        check("unavailable data cannot create a replacement display or false Clear") {
            require(RideTrackingCalculator.displayedContent(summary(nil), previous: nil) == nil, "Missing initial feed")
            require(RideTrackingCalculator.displayedContent(summary(snapshot([], ok: false)), previous: nil) == nil, "Failed initial feed")
            require(RideTrackingCalculator.displayedContent(summary(snapshot([])), previous: nil)?.rideState == "Clear", "A healthy empty feed starts Clear")
        }
        check("all four last known states survive expired feed and location without losing aircraft or distance") {
            for (latitude, state) in [(0.01, "Stop"), (0.05, "Warning"), (0.1, "Watch"), (0.25, "Clear")] {
                let previous = summary(snapshot([plane(latitude: latitude)]))
                require(previous.rideState == state, "Distance must determine the original state")
                let unavailable = RideTrackingCalculator.summarize(snapshot: snapshot([plane(latitude: latitude)]),
                    lat: 0, lon: 0, locationDate: now, configuration: config, now: now.addingTimeInterval(120))
                let retained = RideTrackingCalculator.displayedContent(unavailable, previous: previous)
                require(retained == previous, "Preserve \(state), aircraft, distance, timestamp, and deadline")
                require(retained!.validUntil < now.addingTimeInterval(120), "Keeping the display must not extend data freshness")
            }
        }
        check("missing, failed, mock, and unlocated data retain the last result instead of clearing it") {
            let previous = summary(snapshot([plane()]))
            for candidate in [summary(nil), summary(snapshot([], ok: false)),
                              summary(snapshot([], source: "mock")), summary(snapshot([plane(latitude: nil)]))] {
                require(RideTrackingCalculator.displayedContent(candidate, previous: previous) == previous, "Unavailable update must retain last result")
            }
        }
        check("fresh recovery replaces a retained state and healthy empty data can clear it") {
            let previous = summary(snapshot([plane()]))
            let fresh = summary(snapshot([plane("NEW", latitude: 0.1)]))
            require(RideTrackingCalculator.displayedContent(fresh, previous: previous) == fresh, "Fresh aircraft and Watch must replace Stop")
            let clear = summary(snapshot([]))
            require(RideTrackingCalculator.displayedContent(clear, previous: fresh) == clear, "Healthy empty feed may replace Watch with Clear")
        }
        check("an unavailable placeholder cannot become the last known display") {
            let placeholder = RideTrackingContent.waiting("Waiting for aircraft data", now: now)
            require(RideTrackingCalculator.displayedContent(summary(nil), previous: placeholder) == nil, "Never present Updating as a retained state")
        }
        try check("API decoding and shared ActivityKit content encoding preserve fields") {
            let json = """
            {"fetched_at":1800000000000,"source":"adsbfi","source_ok":true,
             "aircraft":[{"tail":"N123","model":"Cessna","nickname":"Patrol",
             "airborne":true,"lat":0.01,"lon":0,"last_seen_min":0}]}
            """
            let feed = try JSONDecoder().decode(RideTrackingSnapshot.self, from: Data(json.utf8))
            let result = summary(feed)
            require(result.aircraft == "Plane N123", "Legacy feed nicknames must not appear in Live Activity content")
            let roundtrip = try JSONDecoder().decode(RideTrackingContent.self, from: JSONEncoder().encode(result))
            require(roundtrip == result, "App and widget must share content serialization")
        }
        try check("fleet role labels take priority and older feeds fall back to the aircraft model") {
            for (model, role, expected) in [
                ("Cessna", "patrol", "Heli"),
                ("Eurocopter MH-65E Dolphin", "sar", "Heli"),
                ("Bell", "fixed_wing", "Plane"),
                ("Beechcraft B200", "transport", "Plane"),
                ("McDonnell Douglas 369E", "unknown", "Heli"),
                ("Cessna 182T", "unknown", "Plane")
            ] {
                let data = try JSONSerialization.data(withJSONObject: [
                    "tail": "N123", "model": model, "role": role, "airborne": true,
                    "lat": 0.01, "lon": 0, "last_seen_min": 0
                ])
                let aircraft = try JSONDecoder().decode(RideTrackingAircraft.self, from: data)
                let result = summary(snapshot([aircraft]))
                require(result.aircraft == "\(expected) N123", "Decoded role must determine label for \(role)")
                require(RideTrackingCalculator.displayedContent(summary(nil), previous: result) == result,
                        "Stale data must retain the type alongside the tail")
            }
            for model in ["McDonnell Douglas 369E", "Bell OH-58A", "Airbus AS350B3 / H125", "Robinson R66"] {
                let base = plane()
                let helicopter = RideTrackingAircraft(tail: base.tail, model: model, nickname: nil,
                    airborne: true, lat: base.lat, lon: base.lon,
                    position_observed_at: base.position_observed_at, last_seen_min: nil)
                require(summary(snapshot([helicopter])).aircraft == "Heli N123", "Older feed's helicopter model: \(model)")
            }
            require(summary(snapshot([])).aircraft == "No tracked aircraft airborne", "No type label without an aircraft")
        }
        check("aircraft direction is measured from the user across all eight compass sectors") {
            for (latitude, longitude, expected) in [
                (0.01, 0.0, "N"), (0.01, 0.01, "NE"), (0.0, 0.01, "E"),
                (-0.01, 0.01, "SE"), (-0.01, 0.0, "S"), (-0.01, -0.01, "SW"),
                (0.0, -0.01, "W"), (0.01, -0.01, "NW")
            ] {
                let result = summary(snapshot([plane(latitude: latitude, longitude: longitude)]))
                require(result.direction == expected, "Aircraft position should read \(expected)")
                require(result.distanceLabel.hasSuffix("nm \(expected)"), "Direction appears beside the distance")
            }
        }
        check("moving the user changes aircraft direction even at the same rounded distance") {
            let feed = snapshot([plane(latitude: 47.1, longitude: -122)])
            let south = RideTrackingCalculator.summarize(snapshot: feed, lat: 47, lon: -122,
                locationDate: now, configuration: config, now: now)
            let north = RideTrackingCalculator.summarize(snapshot: feed, lat: 47.2, lon: -122,
                locationDate: now, configuration: config, now: now)
            require(south.direction == "N" && north.direction == "S", "Use the user's current position as the origin")
            require(south.distanceNm!.rounded() == north.distanceNm!.rounded(), "Both observations have the same displayed range")
            require(!south.hasSameReadings(as: north), "Direction-only changes must not be suppressed")
            var jitter = south
            jitter.distanceNm = south.distanceNm! + 0.001
            jitter.bearingDegrees = 5
            require(south.hasSameReadings(as: jitter), "Tiny changes within the same displayed range and direction stay coalesced")
        }
        check("compass sectors wrap at north and their halfway boundaries") {
            for (bearing, expected) in [(0.0, "N"), (22.49, "N"), (22.5, "NE"),
                (67.49, "NE"), (67.5, "E"), (337.49, "NW"), (337.5, "N"),
                (360.0, "N"), (-45.0, "NW"), (-360.0, "N")] {
                require(RideTrackingCalculator.cardinalDirection(bearingDegrees: bearing) == expected,
                        "Compass sector for \(bearing)")
            }
            require(RideTrackingCalculator.cardinalDirection(bearingDegrees: .nan) == nil, "No compass direction for NaN")
            require(RideTrackingCalculator.cardinalDirection(bearingDegrees: .infinity) == nil, "No compass direction for infinity")
        }
        check("bearing follows the short crossing of the date line and rejects undefined geometry") {
            let east = RideTrackingCalculator.bearingDegrees(lat: 0, lon: 179.9, aircraftLat: 0, aircraftLon: -179.9)
            let west = RideTrackingCalculator.bearingDegrees(lat: 0, lon: -179.9, aircraftLat: 0, aircraftLon: 179.9)
            require(abs(east! - 90) < 0.001 && abs(west! - 270) < 0.001, "Date line must not reverse east and west")
            require(RideTrackingCalculator.bearingDegrees(lat: 47, lon: -122, aircraftLat: 47, aircraftLon: -122) == nil,
                    "Coincident positions must not invent North")
            require(RideTrackingCalculator.bearingDegrees(lat: 0, lon: 0, aircraftLat: 0, aircraftLon: 180) == nil,
                    "Antipodal positions have no unique bearing")
            require(RideTrackingCalculator.bearingDegrees(lat: .nan, lon: 0, aircraftLat: 0, aircraftLon: 0) == nil,
                    "Invalid rider position has no bearing")
        }
        try check("legacy saved readings decode without direction while new readings preserve it") {
            let result = summary(snapshot([plane()]))
            let data = try JSONEncoder().encode(result)
            let restored = try JSONDecoder().decode(RideTrackingContent.self, from: data)
            require(restored.direction == "N" && restored.bearingDegrees == result.bearingDegrees, "Persist the measured bearing")
            var legacy = try JSONSerialization.jsonObject(with: data) as! [String: Any]
            legacy.removeValue(forKey: "bearingDegrees")
            let old = try JSONDecoder().decode(RideTrackingContent.self,
                from: JSONSerialization.data(withJSONObject: legacy))
            require(old.bearingDegrees == nil && old.direction == nil && old.distanceLabel == "0.6 nm",
                    "Older results keep their distance without inventing a direction")
            let retained = RideTrackingCalculator.displayedContent(summary(nil), previous: restored)
            require(retained == restored && retained?.updatedAt == result.updatedAt, "Retain direction with the original observation time")
        }
        check("empty, first-use and coincident observations do not show a compass direction") {
            for result in [summary(snapshot([])), RideTrackingContent.initial(stateName: "Washington", now: now),
                           summary(snapshot([plane(latitude: 0, longitude: 0)]))] {
                require(result.direction == nil, "No direction without a distinct located aircraft")
            }
        }
        print("\(passed) native live tracking checks passed")
    }
}
