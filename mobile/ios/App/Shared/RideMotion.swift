import Foundation

struct RideGForceReading: Equatable {
    var timestamp: Double
    var longitudinalG: Double
    var lateralG: Double
    var combinedG: Double { hypot(longitudinalG, lateralG) }

    var payload: [String: Any] {
        ["timestamp": timestamp, "longitudinalG": longitudinalG,
         "lateralG": lateralG, "combinedG": combinedG]
    }
}

struct RideGForceSummary: Codable, Equatable {
    var calibratedAt: Double
    var maxAccelerationG = 0.0
    var maxBrakingG = 0.0
    var maxLeftG = 0.0
    var maxRightG = 0.0
    var sampleCount = 0

    var payload: [String: Any] {
        ["calibratedAt": calibratedAt, "maxAccelerationG": maxAccelerationG,
         "maxBrakingG": maxBrakingG, "maxLeftG": maxLeftG,
         "maxRightG": maxRightG, "sampleCount": sampleCount]
    }
}

struct RideMotionSummary: Codable, Equatable {
    var calibratedAt: Double
    var maxLeftRollDegrees = 0.0
    var maxRightRollDegrees = 0.0
    var maxPitchDegrees = 0.0
    var sampleCount = 0

    var payload: [String: Any] {
        ["calibratedAt": calibratedAt, "maxLeftRollDegrees": maxLeftRollDegrees,
         "maxRightRollDegrees": maxRightRollDegrees, "maxPitchDegrees": maxPitchDegrees,
         "sampleCount": sampleCount]
    }
}

struct RideMotionVector {
    var x: Double
    var y: Double
    var z: Double
    var length: Double { sqrt(dot(self)) }
    func dot(_ other: Self) -> Double { x * other.x + y * other.y + z * other.z }
    func scaled(_ value: Double) -> Self { Self(x: x * value, y: y * value, z: z * value) }
    func subtracting(_ other: Self) -> Self { Self(x: x - other.x, y: y - other.y, z: z - other.z) }
    func cross(_ other: Self) -> Self {
        Self(x: y * other.z - z * other.y, y: z * other.x - x * other.z, z: x * other.y - y * other.x)
    }
    var unit: Self? {
        let size = length
        guard size.isFinite, size > 0.0001 else { return nil }
        return scaled(1 / size)
    }
}

struct RideMotionAngles {
    var left: Double
    var right: Double
    var noseUp: Double
}

// These fixed bike axes compensate for the mount's initial tilt. Core Motion's
// fused gravity supplies world vertical in phone coordinates, so heading turns
// cannot become roll/pitch. Raw accelerometer force is never treated as tilt.
struct RideMotionTracker {
    private var up: RideMotionVector?
    private var right: RideMotionVector?
    private var forward: RideMotionVector?
    private var gForceForward: RideMotionVector?
    private var recent: [(time: Double, angles: RideMotionAngles)] = []
    private var orientation: (time: Double, roll: Double, pitch: Double)?
    var calibrated: Bool { up != nil }

    // Project the mounted bike's forward axis onto the current horizontal plane.
    // Bike lean must not turn vertical load into sideways cornering acceleration.
    // Live samples stay immediate; the recorder confirms sustained peaks separately.
    func gForce(acceleration: RideMotionVector, gravity: RideMotionVector,
                timestamp: Double) -> RideGForceReading? {
        guard timestamp.isFinite, acceleration.length.isFinite,
              gravity.length > 0.8, gravity.length < 1.2,
              let vertical = gravity.scaled(-1).unit, let forward = gForceForward else { return nil }
        let projected = forward.subtracting(vertical.scaled(forward.dot(vertical)))
        // Forward/backward is undefined when the bike points vertically.
        guard projected.length > 0.05, let horizontalForward = projected.unit,
              let horizontalRight = horizontalForward.cross(vertical).unit else { return nil }
        // Core Motion userAcceleration follows inertial-force signs, opposite
        // physical device acceleration. Normalize only this vector, not gravity:
        // speeding up is +forward, braking is -forward, and a right turn is +right.
        return RideGForceReading(timestamp: timestamp,
            longitudinalG: -acceleration.dot(horizontalForward),
            lateralG: -acceleration.dot(horizontalRight))
    }

    mutating func calibrate(gravity: RideMotionVector) -> Bool {
        guard gravity.length > 0.8, gravity.length < 1.2,
              let up = gravity.scaled(-1).unit else { return false }
        let phoneRight = RideMotionVector(x: 1, y: 0, z: 0)
        let projectedRight = phoneRight.subtracting(up.scaled(phoneRight.dot(up)))
        let right: RideMotionVector
        if projectedRight.length > 0.1, let horizontalRight = projectedRight.unit {
            right = horizontalRight
        } else {
            // If the phone's right axis is vertical, use its top edge for the
            // forward direction. This avoids rejecting a valid starting pose
            // or amplifying tiny sensor noise when projecting a vertical axis.
            let phoneTop = RideMotionVector(x: 0, y: 1, z: 0)
            guard let forward = phoneTop.subtracting(up.scaled(phoneTop.dot(up))).unit,
                  let horizontalRight = forward.cross(up).unit else { return false }
            right = horizontalRight
        }
        self.up = up
        self.right = right
        self.forward = up.cross(right)
        // The screen's horizontal intersection accounts for a mount that is
        // both tilted and side-canted without introducing a heading offset.
        // A flat screen has no such intersection; use the existing mount axes.
        let screenRight = RideMotionVector(x: up.y, y: -up.x, z: 0)
        if screenRight.length > 0.1, var horizontalRight = screenRight.unit {
            if horizontalRight.x < 0 { horizontalRight = horizontalRight.scaled(-1) }
            gForceForward = up.cross(horizontalRight)
        } else {
            gForceForward = self.forward
        }
        resetSamples()
        return true
    }

    mutating func resetSamples(preservingOrientation: Bool = false) {
        recent.removeAll()
        if !preservingOrientation { orientation = nil }
    }

    mutating func accept(gravity: RideMotionVector, timestamp: Double,
                         rotationRate: RideMotionVector? = nil) -> RideMotionAngles? {
        guard timestamp.isFinite, gravity.length > 0.8, gravity.length < 1.2,
              let vertical = gravity.scaled(-1).unit,
              let up, let right, let forward else { resetSamples(); return nil }
        if let last = orientation {
            guard timestamp > last.time else { return nil }
            if timestamp - last.time > 0.2 { resetSamples() }
        }
        let rightUp = vertical.dot(right)
        let upUp = vertical.dot(up)
        let forwardUp = vertical.dot(forward)
        let priorRoll = orientation?.roll ?? 0
        var predictedPitch = orientation?.pitch ?? 0
        if let prior = orientation, let rotationRate, rotationRate.length.isFinite {
            // Body gyro rates predict which side of vertical the pitch is on.
            // Combining right/up rates removes roll's effect on pitch rate.
            let radians = prior.roll * .pi / 180
            let pitchRate = rotationRate.dot(right) * cos(radians) + rotationRate.dot(up) * sin(radians)
            predictedPitch += pitchRate * (timestamp - prior.time) * 180 / .pi
        }
        let horizontal = hypot(rightUp, upUp)
        let principalPitch = atan2(forwardUp, horizontal) * 180 / .pi
        let principalRoll = atan2(-rightUp, upUp) * 180 / .pi
        let alternatePitch = principalPitch >= 0 ? 180 - principalPitch : -180 - principalPitch
        // Gravity has two Euler representations. Follow the continuous one
        // rather than folding 100° back to 80° and inventing a 180° roll.
        // At vertical, roll cannot be observed from gravity; retain its last
        // value while the gyro guides pitch through the singularity.
        let firstRoll = horizontal < 0.02 ? priorRoll : Self.unwrap(principalRoll, near: priorRoll)
        let secondRoll = horizontal < 0.02 ? priorRoll : Self.unwrap(principalRoll + 180, near: priorRoll)
        let firstPitch = Self.unwrap(principalPitch, near: predictedPitch)
        let secondPitch = Self.unwrap(alternatePitch, near: predictedPitch)
        let firstChange = pow(firstRoll - priorRoll, 2) + pow(firstPitch - predictedPitch, 2)
        let secondChange = pow(secondRoll - priorRoll, 2) + pow(secondPitch - predictedPitch, 2)
        let roll = firstChange <= secondChange ? firstRoll : secondRoll
        let pitch = firstChange <= secondChange ? firstPitch : secondPitch
        orientation = (timestamp, roll, pitch)
        recent.append((timestamp, RideMotionAngles(left: max(0, -roll), right: max(0, roll), noseUp: max(0, pitch))))
        recent = Array(recent.suffix(4))
        // A peak must persist across four updates (~120ms at 25Hz). One
        // isolated spike, duplicate, or resumed stream cannot establish a peak.
        guard recent.count == 4, timestamp - recent[0].time >= 0.10 else { return nil }
        return RideMotionAngles(left: recent.map(\.angles.left).min()!,
            right: recent.map(\.angles.right).min()!, noseUp: recent.map(\.angles.noseUp).min()!)
    }

    private static func unwrap(_ angle: Double, near reference: Double) -> Double {
        var difference = (angle - reference).truncatingRemainder(dividingBy: 360)
        if difference > 180 { difference -= 360 }
        if difference < -180 { difference += 360 }
        return reference + difference
    }
}
