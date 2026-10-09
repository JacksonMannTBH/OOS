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
                   airborne: Bool = true, age: Double = 0,
                   timestamp: Bool = true) -> RideTrackingAircraft {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return RideTrackingAircraft(tail: tail, model: "Cessna", nickname: nil,
                airborne: airborne, lat: latitude, lon: 0,
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
            require(result.aircraft == "NEAR", "Must select nearest airborne contact")
            require(abs((result.distanceNm ?? 0) - 0.6004) < 0.002, "Must calculate nautical miles")
            require(result.rideState == "Stop", "Nearest contact should determine status")
        }
        check("aircraft exclusions apply before choosing nearest") {
            var selected = config
            selected.excludedTails = ["N123"]
            let result = summary(snapshot([plane(), plane("OTHER", latitude: 0.1)]), configuration: selected)
            require(result.aircraft == "OTHER" && result.rideState == "Watch", "Excluded aircraft cannot determine state")
        }
        check("healthy empty feed can show Clear without inventing a distance") {
            let result = summary(snapshot([]))
            require(result.rideState == "Clear" && result.distanceNm == nil, "No artificial zero-distance aircraft")
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
        check("unlocated airborne aircraft cannot produce a false Clear or false nearest") {
            require(summary(snapshot([plane(latitude: nil)])).rideState == "Updating", "Missing aircraft position")
            require(summary(snapshot([plane("VALID"), plane("UNKNOWN", latitude: nil)])).rideState == "Updating", "Unknown aircraft might be closer")
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
            let result = RideTrackingCalculator.summarize(snapshot: snapshot([]), lat: .nan, lon: 0,
                locationDate: now, configuration: config, now: now)
            require(result.rideState == "Updating", "Invalid location")
        }
        try check("API decoding and shared ActivityKit content encoding preserve fields") {
            let json = """
            {"fetched_at":1800000000000,"source":"adsbfi","source_ok":true,
             "aircraft":[{"tail":"N123","model":"Cessna","nickname":"Patrol",
             "airborne":true,"lat":0.01,"lon":0,"last_seen_min":0}]}
            """
            let feed = try JSONDecoder().decode(RideTrackingSnapshot.self, from: Data(json.utf8))
            let result = summary(feed)
            require(result.aircraft == "Patrol · N123", "Identity preserved")
            let roundtrip = try JSONDecoder().decode(RideTrackingContent.self, from: JSONEncoder().encode(result))
            require(roundtrip == result, "App and widget must share content serialization")
        }
        print("\(passed) native live tracking checks passed")
    }
}
