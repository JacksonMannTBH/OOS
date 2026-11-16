import Foundation

// Shared with the widget so freshness and labels have a single definition.
struct RideTrackingContent: Codable, Hashable {
    var aircraft: String
    var distanceNm: Double?
    var rideState: String
    var message: String
    var updatedAt: Date
    var validUntil: Date
    var stateName: String = ""
    var aircraftTail: String? = nil
    var vehicleLabel: String? = nil
    var bearingDegrees: Double? = nil

    var hasKnownRideState: Bool {
        ["Clear", "Watch", "Warning", "Stop"].contains(rideState)
    }

    var direction: String? {
        guard hasKnownRideState, let distanceNm, distanceNm.isFinite, distanceNm > 0,
              let bearingDegrees else { return nil }
        return RideTrackingCalculator.cardinalDirection(bearingDegrees: bearingDegrees)
    }

    var distanceValueLabel: String {
        guard let distanceNm else { return "— nm" }
        return String(format: "%.1f nm", distanceNm)
    }

    var distanceLabel: String {
        direction.map { "\(distanceValueLabel) \($0)" } ?? distanceValueLabel
    }

    func hasSameReadings(as other: Self) -> Bool {
        aircraft == other.aircraft && rideState == other.rideState &&
        message == other.message && stateName == other.stateName &&
        distanceNm.map { ($0 * 10).rounded() } == other.distanceNm.map { ($0 * 10).rounded() } &&
        direction == other.direction
    }

    // Reuse the complete last result, including its observation time. On first
    // use there is no measured state yet; don't invent Clear or show a spinner.
    static func initial(stateName: String, previous: Self? = nil, now: Date = Date()) -> Self {
        if let previous, previous.hasKnownRideState { return previous }
        return Self(aircraft: "Live tracking", distanceNm: nil, rideState: "",
             message: "", updatedAt: now,
             validUntil: now.addingTimeInterval(30), stateName: stateName)
    }

    static func waiting(_ message: String, now: Date = Date()) -> Self {
        Self(aircraft: "Nearest aircraft", distanceNm: nil, rideState: "Updating",
             message: message, updatedAt: now, validUntil: now.addingTimeInterval(30))
    }
}

struct RideTrackingConfiguration: Codable, Equatable {
    var stateCode: String
    var stateName: String
    var excludedTails: Set<String>
    var watchNm: Double
    var warningNm: Double
    var stopNm: Double

    func label(distanceNm: Double?) -> String {
        guard let distance = distanceNm else { return "Clear" }
        if distance <= stopNm { return "Stop" }
        if distance <= warningNm { return "Warning" }
        if distance <= watchNm { return "Watch" }
        return "Clear"
    }
}

struct RideTrackingSnapshot: Decodable {
    let fetched_at: Double
    let source_ok: Bool?
    let source: String
    let aircraft: [RideTrackingAircraft]
}

struct RideTrackingAircraft: Decodable {
    let tail: String
    let model: String
    let nickname: String?
    let airborne: Bool
    let lat: Double?
    let lon: Double?
    let position_observed_at: String?
    let last_seen_min: Double?
    var role: String? = nil
    var observed_at: String? = nil
    var observed: Bool? = nil

    var vehicleLabel: String {
        // Match the app's fleet icons; use the model for older feeds without a role.
        switch role {
        case "patrol", "sar": return "Heli"
        case "fixed_wing", "transport": return "Plane"
        default:
            let helicopterModel = #"\b(airbus|eurocopter|as350|h125|h135|h145|ec120|ec130|ec135|ec145|bk117|mbb|bell|mcdonnell douglas|md helicopters|md\s?(?:369|500|520|530|600)|369e|369ff|500n|600n|hughes|schweizer|robinson|r44|r66|jet\s?ranger|iroquois|huey|dolphin|uh-1|uh-60|hh-1|oh-58|th-57|th-67|sikorsky|s-70|agusta|leonardo|enstrom)\b"#
            return model.range(of: helicopterModel, options: [.regularExpression, .caseInsensitive]) == nil ? "Plane" : "Heli"
        }
    }
}

enum RideTrackingCalculator {
    // Match the map's per-aircraft four-minute report timeout. A healthy fleet
    // refresh must not keep an aircraft airborne using an old individual report.
    static let aircraftReportTimeout: TimeInterval = 4 * 60

    // Unavailable data must not invent a fresh distance or state. Keep the
    // complete last known result, including its original timestamp/deadline.
    // A saved result remains visible until another measured result is available.
    static func displayedContent(_ candidate: RideTrackingContent,
                                 previous: RideTrackingContent?) -> RideTrackingContent? {
        if candidate.hasKnownRideState { return candidate }
        return previous?.hasKnownRideState == true ? previous : nil
    }

    static func distanceNm(lat: Double, lon: Double, aircraftLat: Double, aircraftLon: Double) -> Double {
        let r = Double.pi / 180
        let dLat = (aircraftLat - lat) * r
        let dLon = (aircraftLon - lon) * r
        let a = pow(sin(dLat / 2), 2) + cos(lat * r) * cos(aircraftLat * r) * pow(sin(dLon / 2), 2)
        return 3440.065 * 2 * atan2(sqrt(max(0, min(1, a))), sqrt(max(0, 1 - a)))
    }

    // Initial true bearing from the user to the aircraft, independent of either
    // device orientation or the aircraft's own heading. Coincident/antipodal
    // positions have no unique direction and must not manufacture North.
    static func bearingDegrees(lat: Double, lon: Double, aircraftLat: Double, aircraftLon: Double) -> Double? {
        guard lat.isFinite, lon.isFinite, aircraftLat.isFinite, aircraftLon.isFinite,
              abs(lat) <= 90, abs(aircraftLat) <= 90,
              abs(lon) <= 180, abs(aircraftLon) <= 180 else { return nil }
        let r = Double.pi / 180
        let from = lat * r
        let to = aircraftLat * r
        let deltaLon = (aircraftLon - lon) * r
        let y = sin(deltaLon) * cos(to)
        let x = cos(from) * sin(to) - sin(from) * cos(to) * cos(deltaLon)
        guard hypot(x, y) > 1e-12 else { return nil }
        return (atan2(y, x) / r + 360).truncatingRemainder(dividingBy: 360)
    }

    static func cardinalDirection(bearingDegrees: Double) -> String? {
        guard bearingDegrees.isFinite else { return nil }
        let normalized = (bearingDegrees.truncatingRemainder(dividingBy: 360) + 360)
            .truncatingRemainder(dividingBy: 360)
        let labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        return labels[Int((normalized / 45).rounded()) % labels.count]
    }

    static func summarize(snapshot: RideTrackingSnapshot?, lat: Double?, lon: Double?,
                          locationDate: Date?, configuration: RideTrackingConfiguration,
                          now: Date = Date()) -> RideTrackingContent {
        guard let snapshot, snapshot.source_ok != false, snapshot.source != "mock",
              snapshot.fetched_at.isFinite else {
            return .waiting("Waiting for aircraft data", now: now)
        }
        let feedDate = Date(timeIntervalSince1970: snapshot.fetched_at / 1000)
        guard now.timeIntervalSince(feedDate) <= 45, now.timeIntervalSince(feedDate) >= -5 else {
            return .waiting("Aircraft data is out of date", now: now)
        }
        let airborne = snapshot.aircraft.filter {
            $0.airborne && $0.observed != false &&
            !configuration.excludedTails.contains($0.tail.uppercased()) &&
            !reportExpired($0, feedDate: feedDate, now: now)
        }
        // A confirmed landing or report timeout needs no rider position. Waiting
        // for GPS here would retain an aircraft the map has already removed.
        if airborne.isEmpty {
            return RideTrackingContent(aircraft: "No tracked aircraft airborne", distanceNm: nil,
                rideState: "Clear", message: configuration.stateName, updatedAt: feedDate,
                validUntil: feedDate.addingTimeInterval(45))
        }
        guard let lat, let lon, lat.isFinite, lon.isFinite, abs(lat) <= 90, abs(lon) <= 180,
              let locationDate, now.timeIntervalSince(locationDate) <= 30,
              now.timeIntervalSince(locationDate) >= -5 else {
            return .waiting("Waiting for current location", now: now)
        }
        var expiry = min(feedDate.addingTimeInterval(45), locationDate.addingTimeInterval(30))
        var nearest: (plane: RideTrackingAircraft, distance: Double, bearing: Double?, expiry: Date)?
        var unavailable = false
        for plane in airborne {
            guard let pLat = plane.lat, let pLon = plane.lon, pLat.isFinite, pLon.isFinite,
                  abs(pLat) <= 90, abs(pLon) <= 180 else { unavailable = true; continue }
            var positionExpiry = feedDate.addingTimeInterval(45)
            if let timestamp = plane.position_observed_at {
                guard let date = parseDate(timestamp), now.timeIntervalSince(date) <= 90,
                      now.timeIntervalSince(date) >= -5 else { unavailable = true; continue }
                positionExpiry = date.addingTimeInterval(90)
            } else if let age = plane.last_seen_min {
                guard age.isFinite, age >= 0, age <= 1.5 else { unavailable = true; continue }
                positionExpiry = feedDate.addingTimeInterval(90 - age * 60)
            } else {
                // A successful HTTP response alone doesn't establish position freshness.
                unavailable = true
                continue
            }
            guard positionExpiry > now else { unavailable = true; continue }
            let distance = distanceNm(lat: lat, lon: lon, aircraftLat: pLat, aircraftLon: pLon)
            if nearest == nil || distance < nearest!.distance {
                nearest = (plane, distance,
                    bearingDegrees(lat: lat, lon: lon, aircraftLat: pLat, aircraftLon: pLon), positionExpiry)
            }
        }
        // Use the nearest contact with usable coordinates. A separate aircraft
        // without a position must not suppress every located aircraft statewide.
        if let nearest {
            expiry = min(expiry, nearest.expiry)
            let name = "\(nearest.plane.vehicleLabel) \(nearest.plane.tail)"
            return RideTrackingContent(aircraft: name, distanceNm: nearest.distance,
                                       rideState: configuration.label(distanceNm: nearest.distance),
                                       message: nearest.plane.model, updatedAt: min(feedDate, locationDate),
                                       validUntil: expiry, aircraftTail: nearest.plane.tail,
                                       vehicleLabel: nearest.plane.vehicleLabel,
                                       bearingDegrees: nearest.bearing)
        }
        if unavailable { return .waiting("Some aircraft positions are unavailable", now: now) }
        return .waiting("Waiting for aircraft data", now: now)
    }

    private static func reportExpired(_ aircraft: RideTrackingAircraft, feedDate: Date, now: Date) -> Bool {
        let reportedAt: Date?
        if let timestamp = aircraft.observed_at {
            reportedAt = parseDate(timestamp)
        } else if let timestamp = aircraft.position_observed_at {
            reportedAt = parseDate(timestamp)
        } else if let age = aircraft.last_seen_min, age.isFinite, age >= 0 {
            reportedAt = feedDate.addingTimeInterval(-age * 60)
        } else {
            reportedAt = nil
        }
        // Unknown or malformed report times are unavailable, not proof of landing.
        guard let reportedAt, reportedAt.timeIntervalSince1970 > 0 else { return false }
        return now.timeIntervalSince(reportedAt) >= aircraftReportTimeout
    }

    private static func parseDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}
