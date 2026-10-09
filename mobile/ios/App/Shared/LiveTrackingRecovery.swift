import Foundation

struct SavedLiveTrackingSession: Codable {
    var enabled: Bool
    var activityID: String?
    var configuration: RideTrackingConfiguration?
    var startedAt: Date?
}

struct RecoverableLiveActivity {
    var id: String
    var canUpdate: Bool
    var updatedAt: Date
}

enum LiveTrackingRecovery {
    static func activityID(session: SavedLiveTrackingSession?, activities: [RecoverableLiveActivity]) -> String? {
        // A saved explicit Stop wins over any late or still-visible activity.
        guard session?.enabled != false else { return nil }
        let available = activities.filter(\.canUpdate)
        if let id = session?.activityID, available.contains(where: { $0.id == id }) { return id }
        return available.max(by: { $0.updatedAt < $1.updatedAt })?.id
    }
}

enum LiveTrackingStopReason: String {
    case userStop, systemEnded, systemDismissed
    var shouldRemoveActivity: Bool { self == .userStop }
}

struct LiveTrackingDiagnostic: Codable {
    var date: Date
    var event: String
    var detail: String
}

struct LiveTrackingPersistence {
    static let shared = Self(directory: FileManager.default.urls(for: .applicationSupportDirectory,
        in: .userDomainMask).first!.appendingPathComponent("OOSLiveTracking"))
    let directory: URL

    func load() -> SavedLiveTrackingSession? {
        (try? Data(contentsOf: directory.appendingPathComponent("session.json")))
            .flatMap { try? JSONDecoder().decode(SavedLiveTrackingSession.self, from: $0) }
    }
    func save(_ session: SavedLiveTrackingSession) { write(session, to: "session.json") }

    // A bounded on-device log: lifecycle/reason codes only, no location or push tokens.
    func record(_ event: String, detail: String = "", now: Date = Date()) {
        var events = (try? Data(contentsOf: directory.appendingPathComponent("events.json")))
            .flatMap { try? JSONDecoder().decode([LiveTrackingDiagnostic].self, from: $0) } ?? []
        events.append(LiveTrackingDiagnostic(date: now, event: event, detail: String(detail.prefix(160))))
        write(Array(events.suffix(160)), to: "events.json")
    }

    private func write<T: Encodable>(_ value: T, to filename: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            var options: Data.WritingOptions = [.atomic]
            #if os(iOS)
            options.insert(.completeFileProtectionUntilFirstUserAuthentication)
            #endif
            try data.write(to: directory.appendingPathComponent(filename), options: options)
        } catch { /* A persistence failure must not end the visible activity. */ }
    }
}
