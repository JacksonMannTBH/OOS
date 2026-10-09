import Foundation

@main
enum LiveTrackingRecoveryTests {
    static func main() throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let config = RideTrackingConfiguration(stateCode: "WA", stateName: "Washington",
            excludedTails: ["N111"], watchNm: 10, warningNm: 5, stopNm: 2)
        let saved = SavedLiveTrackingSession(enabled: true, activityID: "existing", configuration: config, startedAt: now)
        let existing = RecoverableLiveActivity(id: "existing", canUpdate: true, updatedAt: now)
        let newer = RecoverableLiveActivity(id: "newer", canUpdate: true, updatedAt: now.addingTimeInterval(60))
        let ended = RecoverableLiveActivity(id: "ended", canUpdate: false, updatedAt: now.addingTimeInterval(120))
        var passed = 0
        func check(_ title: String, _ body: () throws -> Void) rethrows {
            try body(); passed += 1; print("PASS \(title)")
        }
        func require(_ condition: Bool, _ message: String) { precondition(condition, message) }

        check("relaunch resumes the saved updatable activity rather than replacing it") {
            require(LiveTrackingRecovery.activityID(session: saved, activities: [newer, existing]) == "existing", "Keep existing identity")
        }
        check("an explicit stop prevents recovery even if a late activity remains visible") {
            require(LiveTrackingRecovery.activityID(session: .init(enabled: false), activities: [existing]) == nil, "Stop must win")
        }
        check("ended and dismissed activities cannot restart location tracking") {
            require(LiveTrackingRecovery.activityID(session: saved, activities: [ended]) == nil, "Only active/stale activity may resume")
        }
        check("legacy sessions recover their latest updatable activity without creating a new one") {
            require(LiveTrackingRecovery.activityID(session: nil, activities: [existing, ended, newer]) == "newer", "Ignore ended, choose newest")
        }
        check("missing activities do not silently start a new session") {
            require(LiveTrackingRecovery.activityID(session: saved, activities: []) == nil, "No new activity after system removal")
        }
        check("only a user stop requests immediate removal, respecting system-ended retention") {
            require(LiveTrackingStopReason.userStop.shouldRemoveActivity, "Explicit Stop removes")
            require(!LiveTrackingStopReason.systemEnded.shouldRemoveActivity, "System end retains OS-managed display")
            require(!LiveTrackingStopReason.systemDismissed.shouldRemoveActivity, "System dismissal is not recreated or ended again")
        }

        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = LiveTrackingPersistence(directory: root.appendingPathComponent("LiveTracking"))
        try check("saved activity identity, preferences and start date survive process recreation without coordinates") {
            store.save(saved)
            let reloaded = LiveTrackingPersistence(directory: store.directory).load()
            require(reloaded?.activityID == "existing" && reloaded?.configuration == config && reloaded?.startedAt == now, "Session round trip")
            let json = String(decoding: try Data(contentsOf: store.directory.appendingPathComponent("session.json")), as: UTF8.self)
            require(!json.contains("latitude") && !json.contains("longitude") && !json.contains("\"lat\"") && !json.contains("\"lon\""), "No rider coordinates")
            store.save(.init(enabled: false))
            require(store.load()?.enabled == false && store.load()?.activityID == nil, "Persist explicit stop across relaunch")
        }
        try check("diagnostics keep only recent reason codes and bounded details") {
            for index in 0..<180 { store.record("event_\(index)", detail: String(repeating: "a", count: 250), now: now) }
            let data = try Data(contentsOf: store.directory.appendingPathComponent("events.json"))
            let events = try JSONDecoder().decode([LiveTrackingDiagnostic].self, from: data)
            require(events.count == 160 && events.first?.event == "event_20" && events.last?.event == "event_179", "Log bounded to latest 160")
            require(events.allSatisfy { $0.detail.count == 160 }, "Details bounded")
        }
        try check("missing or corrupt persistence never invents a running session or blocks recovery") {
            try Data("invalid".utf8).write(to: store.directory.appendingPathComponent("session.json"))
            require(store.load() == nil, "Bad file is not enabled")
            require(LiveTrackingRecovery.activityID(session: store.load(), activities: [existing]) == "existing", "Actual updatable activity can recover")
            try Data("invalid".utf8).write(to: store.directory.appendingPathComponent("events.json"))
            store.record("activity_recovered")
            let events = try JSONDecoder().decode([LiveTrackingDiagnostic].self, from: Data(contentsOf: store.directory.appendingPathComponent("events.json")))
            require(events.count == 1 && events.first?.event == "activity_recovered", "Diagnostic log recovers from corruption")
        }
        print("\(passed) Live Tracking recovery checks passed")
    }
}
