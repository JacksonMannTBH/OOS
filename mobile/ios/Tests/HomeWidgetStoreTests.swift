import Foundation

@main
enum HomeWidgetStoreTests {
    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let directory = root.appendingPathComponent("Library/Application Support/OOSWidgets")
        defer { try? FileManager.default.removeItem(at: root) }
        let store = HomeWidgetStore(directory: directory)
        let configuration = RideTrackingConfiguration(stateCode: "WA", stateName: "Washington",
            excludedTails: ["N111"], watchNm: 10, warningNm: 5, stopNm: 2)
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        func result(_ state: String, at date: Date = Date(timeIntervalSince1970: 1_800_000_000)) -> RideTrackingContent {
            RideTrackingContent(aircraft: "Heli N215SC", distanceNm: 1.4, rideState: state,
                message: "Bell OH-58A", updatedAt: date, validUntil: date.addingTimeInterval(30),
                stateName: "Washington", aircraftTail: "N215SC", vehicleLabel: "Heli")
        }
        var passed = 0
        func check(_ name: String, _ body: () throws -> Void) rethrows {
            try body(); passed += 1; print("PASS \(name)")
        }
        func require(_ condition: Bool, _ message: String) { precondition(condition, message) }

        check("first use has no invented Clear and preferences survive another reader") {
            require(store.read().content == nil, "No content before first known result")
            require(store.configure(configuration), "Save initial settings")
            require(HomeWidgetStore(directory: directory).read().configuration == configuration, "Cross-reader config")
        }
        check("all four states preserve aircraft type, tail, distance and original timestamp on unavailable data") {
            for state in ["Clear", "Watch", "Warning", "Stop"] {
                let known = result(state)
                require(store.publish(known, for: configuration), "Known result must save")
                require(!store.publish(.waiting("Unavailable", now: now.addingTimeInterval(120)), for: configuration), "Unknown data cannot replace result")
                require(HomeWidgetStore(directory: directory).read().content == known, "Complete last known result survives")
            }
        }
        check("late older results cannot overwrite a newer aircraft observation") {
            let newer = result("Watch", at: now.addingTimeInterval(60))
            require(store.publish(newer, for: configuration), "New observation")
            require(!store.publish(result("Stop"), for: configuration), "Reject older completion")
            require(store.read().content == newer, "Newest result retained")
        }
        check("same preferences retain content; region changes invalidate it and reject in-flight old results") {
            let original = store.read().content
            require(!store.configure(configuration), "Identical config does not clear")
            require(store.read().content == original, "Preserve current result")
            var changed = configuration
            changed.stateCode = "OR"; changed.stateName = "Oregon"
            require(store.configure(changed), "Region switch saves")
            require(store.read().content == nil, "Never relabel WA result as OR")
            require(!store.publish(result("Stop"), for: configuration), "Old request must not return cached WA content")
        }
        check("changed exclusions and distance bands cannot reuse a state calculated with old preferences") {
            store.configure(configuration)
            store.publish(result("Stop"), for: configuration)
            var excluded = configuration
            excluded.excludedTails.insert("N215SC")
            store.configure(excluded)
            require(store.read().content == nil, "Excluded aircraft result invalidated")
            require(!store.publish(result("Stop"), for: configuration), "Late old preferences rejected")
            store.publish(result("Clear"), for: excluded)
            var thresholds = excluded
            thresholds.stopNm = 1
            store.configure(thresholds)
            require(store.read().content == nil, "Old distance-band status invalidated")
        }
        try check("the shared file contains no rider coordinates and corruption recovers without a false status") {
            store.configure(configuration)
            store.publish(result("Stop"), for: configuration)
            let file = directory.appendingPathComponent("home-widget.json")
            let data = try Data(contentsOf: file)
            let json = String(decoding: data, as: UTF8.self)
            require(!json.contains("latitude") && !json.contains("longitude") && !json.contains("\"lat\"") && !json.contains("\"lon\""), "Coordinates stay in memory")
            try Data("broken".utf8).write(to: file, options: .atomic)
            require(store.read().configuration == nil && store.read().content == nil, "Corrupt cache must not show Clear")
            require(store.configure(configuration), "Recover by resaving settings")
            require(store.publish(result("Warning"), for: configuration), "Recover actual data")
        }
        check("a missing app group cannot crash or pretend that data was saved") {
            let unavailable = HomeWidgetStore(directory: nil)
            require(!unavailable.configure(configuration), "No write without a container")
            require(!unavailable.publish(result("Clear"), for: configuration), "No saved result")
            require(unavailable.read().content == nil, "Show setup rather than a false Clear")
        }
        print("\(passed) Home Screen widget storage checks passed")
    }
}
