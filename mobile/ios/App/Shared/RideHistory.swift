import Foundation

struct RideRoutePoint: Codable, Equatable {
    var latitude: Double
    var longitude: Double
    var startsSegment: Bool

    var payload: [String: Any] {
        ["latitude": latitude, "longitude": longitude, "startsSegment": startsSegment]
    }
}

struct RecordedRide: Codable, Equatable {
    var id = UUID().uuidString
    var startedAt: Double
    var updatedAt: Double
    var endedAt: Double?
    var distanceMeters = 0.0
    var topSpeedMps: Double?
    var sampleCount = 0
    var hasGaps = false
    var interrupted = false
    // Optional so summaries saved before route recording still decode.
    var route: [RideRoutePoint]?

    var durationSeconds: Double { max(0, ((endedAt ?? updatedAt) - startedAt) / 1000) }
    var payload: [String: Any] {
        ["id": id, "startedAt": startedAt, "updatedAt": updatedAt,
         "endedAt": endedAt.map { $0 as Any } ?? NSNull(),
         "distanceMeters": distanceMeters, "topSpeedMps": topSpeedMps.map { $0 as Any } ?? NSNull(),
         "durationSeconds": durationSeconds, "sampleCount": sampleCount,
         "hasGaps": hasGaps, "interrupted": interrupted,
         "route": (route ?? []).map(\.payload)]
    }
}

struct RideArchive: Codable, Equatable {
    var version = 1
    var consentGiven = false
    var active: RecordedRide?
    var rides: [RecordedRide] = []
}

struct RideLocationSample {
    var timestamp: Double // milliseconds since Unix epoch
    var latitude: Double
    var longitude: Double
    var accuracy: Double
    var speed: Double
    var speedAccuracy: Double

    var reliableSpeed: Double? {
        guard speed.isFinite, speed >= 0, speedAccuracy.isFinite,
              speedAccuracy >= 0, speedAccuracy <= 3 else { return nil }
        return speed
    }
    func distance(to other: Self) -> Double {
        let radians = Double.pi / 180
        let dLat = (other.latitude - latitude) * radians
        let dLon = (other.longitude - longitude) * radians
        let a = pow(sin(dLat / 2), 2) + cos(latitude * radians) * cos(other.latitude * radians) * pow(sin(dLon / 2), 2)
        return 6_371_000 * 2 * atan2(sqrt(max(0, a)), sqrt(max(0, 1 - a)))
    }
}

// Native accumulation is independent of the WebView and aircraft Live Activities.
// Accepted route points are stored locally with the summary. Speed candidates stay in RAM.
struct RideRecorderCore {
    var archive: RideArchive
    private var previous: RideLocationSample?
    private var speedCandidate: RideLocationSample?

    init(archive: RideArchive = RideArchive()) { self.archive = archive }

    mutating func start(now: Double, consent: Bool) throws {
        if archive.active != nil { return }
        guard consent || archive.consentGiven else { throw RideRecordingError.consentRequired }
        archive.consentGiven = true
        archive.active = RecordedRide(startedAt: now, updatedAt: now)
        previous = nil
        speedCandidate = nil
    }

    // Relaunch never pretends that force-quit time was recorded. Preserve the
    // last durable result as a partial ride, without restarting GPS automatically.
    mutating func recoverInterruptedRide() {
        guard var ride = archive.active else { return }
        ride.endedAt = ride.updatedAt
        ride.interrupted = true
        ride.hasGaps = true
        archive.active = nil
        retain(ride)
        previous = nil
        speedCandidate = nil
    }

    mutating func markGap() {
        archive.active?.hasGaps = true
        previous = nil
        speedCandidate = nil
    }

    mutating func accept(_ sample: RideLocationSample, now: Double) {
        guard var ride = archive.active else { return }
        guard sample.timestamp.isFinite else { markGap(); return }
        // Core Location can initially deliver a cached position from before Start.
        // It is not part of this ride, and does not indicate a gap in this ride.
        if sample.timestamp < ride.startedAt { return }
        // Duplicate/out-of-order batches must never inflate distance or peak speed.
        if sample.timestamp < ride.updatedAt || (ride.sampleCount > 0 && sample.timestamp == ride.updatedAt) { return }
        guard sample.timestamp <= now + 5_000, now - sample.timestamp <= 120_000,
              sample.latitude.isFinite, abs(sample.latitude) <= 90,
              sample.longitude.isFinite, abs(sample.longitude) <= 180,
              sample.accuracy.isFinite, sample.accuracy >= 0, sample.accuracy <= 35 else {
            markGap()
            return
        }
        if ride.sampleCount == 0 && sample.timestamp - ride.startedAt > 15_000 { ride.hasGaps = true }
        ride.updatedAt = sample.timestamp
        ride.sampleCount += 1
        if let last = previous {
            let seconds = (sample.timestamp - last.timestamp) / 1000
            let meters = last.distance(to: sample)
            if seconds > 15 {
                ride.hasGaps = true
                speedCandidate = nil
            } else if seconds >= 0.2 {
                let speeds = [last.reliableSpeed, sample.reliableSpeed].compactMap { $0 }
                let plausibleMps = speeds.max().map { max(15, $0 * 1.5 + 8) } ?? 70
                if meters / seconds > plausibleMps {
                    // A location jump cannot become a distance or speed record.
                    ride.hasGaps = true
                    archive.active = ride
                    previous = nil
                    speedCandidate = nil
                    return
                }
                let stationary = speeds.count == 2 && speeds.allSatisfy { $0 < 0.5 }
                let moved = meters >= max(3, (last.accuracy + sample.accuracy) / 2)
                if !stationary && (moved || speeds.contains(where: { $0 >= 0.8 })) {
                    ride.distanceMeters += meters
                }
            }
        }
        if let speed = sample.reliableSpeed {
            if let candidate = speedCandidate, let priorSpeed = candidate.reliableSpeed {
                let seconds = (sample.timestamp - candidate.timestamp) / 1000
                // Two neighboring, consistent readings confirm a peak. A single
                // GPS spike never becomes the saved top recorded speed.
                if seconds >= 0.2 && seconds <= 10,
                   abs(speed - priorSpeed) <= max(3, max(speed, priorSpeed) * 0.15) {
                    ride.topSpeedMps = max(ride.topSpeedMps ?? 0, min(speed, priorSpeed))
                }
            }
            speedCandidate = sample
        } else {
            speedCandidate = nil
        }
        var points = ride.route ?? []
        points.append(RideRoutePoint(latitude: sample.latitude, longitude: sample.longitude,
            startsSegment: previous == nil || sample.timestamp - previous!.timestamp > 15_000))
        ride.route = points
        previous = sample
        archive.active = ride
    }

    mutating func finish(id: String, now: Double) throws -> RecordedRide {
        guard var ride = archive.active else {
            if let existing = archive.rides.first(where: { $0.id == id }) { return existing }
            throw RideRecordingError.noRide
        }
        guard ride.id == id else { throw RideRecordingError.wrongRide }
        if now - ride.updatedAt > 15_000 { ride.hasGaps = true }
        ride.endedAt = max(ride.updatedAt, now)
        archive.active = nil
        retain(ride)
        previous = nil
        speedCandidate = nil
        return ride
    }

    mutating func delete(id: String) throws {
        guard archive.active?.id != id else { throw RideRecordingError.wrongRide }
        archive.rides.removeAll { $0.id == id }
    }

    private mutating func retain(_ ride: RecordedRide) {
        archive.rides.removeAll { $0.id == ride.id }
        archive.rides.insert(ride, at: 0)
        archive.rides = Array(archive.rides.prefix(3))
    }
}

enum RideRecordingError: LocalizedError {
    case consentRequired, noRide, wrongRide, invalidArchive
    var errorDescription: String? {
        switch self {
        case .consentRequired: return "Confirm ride recording before starting."
        case .noRide: return "This ride is no longer available."
        case .wrongRide: return "The active ride has changed. Reopen Ride Mode and try again."
        case .invalidArchive: return "Could not read your saved rides. Reopen OOS to try again."
        }
    }
}

struct RideHistoryStore {
    let url: URL
    func read() throws -> RideArchive {
        guard FileManager.default.fileExists(atPath: url.path) else { return RideArchive() }
        let archive = try JSONDecoder().decode(RideArchive.self, from: Data(contentsOf: url))
        guard archive.version == 1 else { throw RideRecordingError.invalidArchive }
        return archive
    }
    func write(_ archive: RideArchive) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        var options: Data.WritingOptions = [.atomic]
        #if os(iOS)
        options.insert(.completeFileProtectionUntilFirstUserAuthentication)
        #endif
        try JSONEncoder().encode(archive).write(to: url, options: options)
        var file = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? file.setResourceValues(values)
    }
}
