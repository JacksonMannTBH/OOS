import Foundation

struct SharedLocationDemand {
    private var clients: [String: Bool] = [:]
    mutating func subscribe(_ id: String, background: Bool) { clients[id] = background }
    mutating func unsubscribe(_ id: String) { clients.removeValue(forKey: id) }
    var needsBackground: Bool { clients.values.contains(true) }
    func needsUpdates(foreground: Bool) -> Bool { needsBackground || (foreground && !clients.isEmpty) }
}

enum SharedLocationPolicy {
    static func accepts(latitude: Double, longitude: Double, accuracy: Double,
                        timestamp: Date, now: Date, previous: Date?) -> Bool {
        latitude.isFinite && longitude.isFinite && abs(latitude) <= 90 && abs(longitude) <= 180 &&
        accuracy.isFinite && accuracy >= 0 && accuracy <= 100 &&
        timestamp.timeIntervalSince1970.isFinite &&
        now.timeIntervalSince(timestamp) <= 30 && timestamp.timeIntervalSince(now) <= 5 &&
        (previous == nil || timestamp > previous!)
    }
}
