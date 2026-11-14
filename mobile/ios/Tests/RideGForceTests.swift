import Foundation

@main
enum RideGForceTests {
    static func main() throws {
        var passed = 0
        func check(_ name: String, _ test: () throws -> Void) rethrows {
            try test(); passed += 1; print("PASS \(name)")
        }
        func near(_ actual: Double, _ expected: Double) {
            precondition(abs(actual - expected) < 0.000001, "\(actual) != \(expected)")
        }
        func hold(_ core: inout RideRecorderCore, from timestamp: Double,
                  longitudinal: Double, lateral: Double) {
            for sample in 0...5 {
                core.acceptGForce(RideGForceReading(timestamp: timestamp + Double(sample) * 0.04,
                    longitudinalG: longitudinal, lateralG: lateral))
            }
        }
        // Independent rigid-body fixture: express a world vector in a pitched,
        // leaned bike frame, then rotate it into the tilted/canted phone mount.
        func phone(_ world: RideMotionVector, pitch: Double = 0, roll: Double = 0,
                   tilt: Double = 0, cant: Double = 0) -> RideMotionVector {
            let p = pitch * .pi / 180, r = roll * .pi / 180
            let t = tilt * .pi / 180, c = cant * .pi / 180
            let right = RideMotionVector(x: cos(r), y: -cos(p) * sin(r), z: -sin(p) * sin(r))
            let up = RideMotionVector(x: sin(r), y: cos(p) * cos(r), z: sin(p) * cos(r))
            let back = RideMotionVector(x: 0, y: -sin(p), z: cos(p))
            let x = world.dot(right), y = world.dot(up), z = world.dot(back)
            let tiltedY = y * cos(t) - z * sin(t), tiltedZ = y * sin(t) + z * cos(t)
            return RideMotionVector(x: x * cos(c) - tiltedY * sin(c),
                y: x * sin(c) + tiltedY * cos(c), z: tiltedZ)
        }
        let down = RideMotionVector(x: 0, y: -1, z: 0)
        check("G-force requires mounting calibration") {
            let tracker = RideMotionTracker()
            precondition(tracker.gForce(acceleration: RideMotionVector(x: 0.5, y: 0, z: -0.2),
                gravity: down, timestamp: 1) == nil)
        }
        check("stationary movement G is zero and every individual reading is immediate") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: down))
            let zero = tracker.gForce(acceleration: RideMotionVector(x: 0, y: 0, z: 0), gravity: down, timestamp: 1)!
            near(zero.combinedG, 0)
            let first = tracker.gForce(acceleration: RideMotionVector(x: -0.4, y: 0, z: 0.3), gravity: down, timestamp: 1.04)!
            near(first.longitudinalG, 0.3); near(first.lateralG, 0.4); near(first.combinedG, 0.5)
        }
        try check("Core Motion forward and braking signs reach the correct independent peaks") {
            // Portrait, screen facing the rider: +z points back toward the rider.
            // Core Motion reports +z while accelerating forward, -z while braking.
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: down))
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1100)
            let accelerating = tracker.gForce(acceleration: RideMotionVector(x: 0, y: 0, z: 0.6),
                gravity: down, timestamp: 1)!
            near(accelerating.longitudinalG, 0.6); near(accelerating.lateralG, 0)
            hold(&core, from: accelerating.timestamp, longitudinal: accelerating.longitudinalG, lateral: accelerating.lateralG)
            near(core.archive.active!.gForce!.maxAccelerationG, 0.6)
            near(core.archive.active!.gForce!.maxBrakingG, 0)
            let braking = tracker.gForce(acceleration: RideMotionVector(x: 0, y: 0, z: -0.4),
                gravity: down, timestamp: 2)!
            near(braking.longitudinalG, -0.4); near(braking.lateralG, 0)
            hold(&core, from: braking.timestamp, longitudinal: braking.longitudinalG, lateral: braking.lateralG)
            near(core.archive.active!.gForce!.maxAccelerationG, 0.6)
            near(core.archive.active!.gForce!.maxBrakingG, 0.4)
            near(core.archive.active!.gForce!.maxLeftG, 0)
            near(core.archive.active!.gForce!.maxRightG, 0)
            let saved = try core.finish(id: core.archive.active!.id, now: 2000)
            precondition((saved.payload["gForce"] as? [String: Any])?["maxAccelerationG"] as? Double == 0.6)
            precondition((saved.payload["gForce"] as? [String: Any])?["maxBrakingG"] as? Double == 0.4)
        }
        check("Core Motion left and right signs remain separate from acceleration and braking") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: down))
            let left = tracker.gForce(acceleration: RideMotionVector(x: 0.5, y: 0, z: 0),
                gravity: down, timestamp: 1)!
            let right = tracker.gForce(acceleration: RideMotionVector(x: -0.7, y: 0, z: 0),
                gravity: down, timestamp: 2)!
            near(left.longitudinalG, 0); near(left.lateralG, -0.5)
            near(right.longitudinalG, 0); near(right.lateralG, 0.7)
        }
        check("lean, pitch and mounting tilt preserve horizontal G and exclude vertical load") {
            for tilt in [-75.0, 0, 65] {
                for cant in [-45.0, 0, 35] {
                    var tracker = RideMotionTracker()
                    precondition(tracker.calibrate(gravity: phone(down, tilt: tilt, cant: cant)))
                    for pitch in [-30.0, 0, 35] {
                        for roll in [-65.0, 0, 65] {
                            for direction in [-1.0, 1] {
                                let gravity = phone(down, pitch: pitch, roll: roll, tilt: tilt, cant: cant)
                                let force = phone(RideMotionVector(x: direction * 0.6, y: 2, z: -direction * 0.8),
                                    pitch: pitch, roll: roll, tilt: tilt, cant: cant)
                                // The independently rotated physical acceleration is
                                // reported with the opposite sign by Core Motion.
                                let reading = tracker.gForce(acceleration: force.scaled(-1), gravity: gravity, timestamp: 1)!
                                near(reading.longitudinalG, direction * 0.8)
                                near(reading.lateralG, direction * 0.6)
                                near(reading.combinedG, 1)
                            }
                        }
                    }
                }
            }
        }
        try check("brief spikes do not become peaks; sustained forces stay independent of angles and persist") {
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1100, recordAngles: false)
            precondition(core.archive.active?.motion == nil)
            for reading in [
                RideGForceReading(timestamp: 1, longitudinalG: 0.2, lateralG: -0.4),
                RideGForceReading(timestamp: 1.04, longitudinalG: 3.4, lateralG: 1.1),
                RideGForceReading(timestamp: 1.08, longitudinalG: -0.7, lateralG: 0.1),
            ] { core.acceptGForce(reading) }
            let summary = core.archive.active!.gForce!
            near(summary.maxAccelerationG, 0); near(summary.maxBrakingG, 0)
            near(summary.maxLeftG, 0); near(summary.maxRightG, 0)
            precondition(summary.sampleCount == 3)
            hold(&core, from: 2, longitudinal: 0.6, lateral: -0.4)
            hold(&core, from: 3, longitudinal: -0.7, lateral: 0.5)
            near(core.archive.active!.gForce!.maxAccelerationG, 0.6)
            near(core.archive.active!.gForce!.maxBrakingG, 0.7)
            near(core.archive.active!.gForce!.maxLeftG, 0.4)
            near(core.archive.active!.gForce!.maxRightG, 0.5)
            try core.calibrateMotion(now: 1300, recordAngles: true)
            precondition(core.archive.active?.gForce?.maxAccelerationG == 0.6)
            core.acceptMotion(RideMotionAngles(left: 30, right: 40, noseUp: 15))
            let beforeReset = core.archive.active!.gForce
            try core.resetMotionPeaks(id: core.archive.active!.id)
            precondition(core.archive.active!.gForce == beforeReset)
            let ride = try core.finish(id: core.archive.active!.id, now: 2000)
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: folder) }
            let store = RideHistoryStore(url: folder.appendingPathComponent("rides.json"))
            try store.write(core.archive)
            let restored = try store.read()
            precondition(restored == core.archive)
            precondition((ride.payload["gForce"] as? [String: Any])?["maxAccelerationG"] as? Double == 0.6)
            try core.start(now: 3000, consent: false)
            precondition(core.archive.active?.gForce == nil)
        }
        try check("a spike inside sustained movement cannot inflate the confirmed peak") {
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1100, recordAngles: false)
            for sample in 0...15 {
                let spike = sample == 7
                core.acceptGForce(RideGForceReading(timestamp: 1 + Double(sample) * 0.04,
                    longitudinalG: spike ? 3.4 : 0.5, lateralG: spike ? -2 : -0.3))
            }
            near(core.archive.active!.gForce!.maxAccelerationG, 0.5)
            near(core.archive.active!.gForce!.maxLeftG, 0.3)
            hold(&core, from: 2, longitudinal: 0.8, lateral: -0.6)
            near(core.archive.active!.gForce!.maxAccelerationG, 0.8)
            near(core.archive.active!.gForce!.maxLeftG, 0.6)
        }
        try check("rapid direction changes and sensor gaps cannot confirm a peak") {
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1100)
            for sample in 0...15 {
                let sign = sample.isMultiple(of: 2) ? 1.0 : -1.0
                core.acceptGForce(RideGForceReading(timestamp: 1 + Double(sample) * 0.04,
                    longitudinalG: sign * 0.9, lateralG: sign * 0.8))
            }
            for time in [2.0, 2.04, 2.08, 2.4, 2.44, 2.48] {
                core.acceptGForce(RideGForceReading(timestamp: time, longitudinalG: 1, lateralG: 1))
            }
            let peaks = core.archive.active!.gForce!
            near(peaks.maxAccelerationG, 0); near(peaks.maxBrakingG, 0)
            near(peaks.maxLeftG, 0); near(peaks.maxRightG, 0)
            hold(&core, from: 3, longitudinal: -0.7, lateral: 0.6)
            near(core.archive.active!.gForce!.maxBrakingG, 0.7)
            near(core.archive.active!.gForce!.maxRightG, 0.6)
        }
        try check("pause, invalid readings, recalibration and peak reset discard unfinished candidates") {
            for interruption in ["pause", "invalid", "calibrate", "reset"] {
                var core = RideRecorderCore()
                try core.start(now: 1000, consent: true)
                try core.calibrateMotion(now: 1100)
                for sample in 0...4 {
                    core.acceptGForce(RideGForceReading(timestamp: 1 + Double(sample) * 0.04,
                        longitudinalG: 0.9, lateralG: -0.8))
                }
                switch interruption {
                case "pause": core.resetGForceCandidates()
                case "invalid": core.acceptGForce(RideGForceReading(timestamp: 1.18, longitudinalG: .nan, lateralG: 0))
                case "calibrate": try core.calibrateMotion(now: 1200)
                default: try core.resetGForcePeaks(id: core.archive.active!.id)
                }
                core.acceptGForce(RideGForceReading(timestamp: 1.2, longitudinalG: 0.9, lateralG: -0.8))
                near(core.archive.active!.gForce!.maxAccelerationG, 0)
                near(core.archive.active!.gForce!.maxLeftG, 0)
                hold(&core, from: 1.24, longitudinal: 0.4, lateral: -0.3)
                near(core.archive.active!.gForce!.maxAccelerationG, 0.4)
                near(core.archive.active!.gForce!.maxLeftG, 0.3)
            }
        }
        try check("duplicates and out-of-order readings cannot qualify or inflate peaks") {
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1100)
            for time in [1.0, 1.04, 1.08] {
                core.acceptGForce(RideGForceReading(timestamp: time, longitudinalG: 0.5, lateralG: 0))
            }
            for time in [1.08, 1.04, 1.0] {
                core.acceptGForce(RideGForceReading(timestamp: time, longitudinalG: 9, lateralG: 9))
            }
            precondition(core.archive.active!.gForce!.sampleCount == 3)
            near(core.archive.active!.gForce!.maxAccelerationG, 0)
            for time in [1.12, 1.16, 1.2] {
                core.acceptGForce(RideGForceReading(timestamp: time, longitudinalG: 0.5, lateralG: 0))
            }
            near(core.archive.active!.gForce!.maxAccelerationG, 0.5)
            near(core.archive.active!.gForce!.maxRightG, 0)
        }
        try check("G-force reset preserves calibration, angles, ride stats and saved rides, and persists") {
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1100)
            core.acceptGForce(RideGForceReading(timestamp: 1, longitudinalG: 1, lateralG: 1))
            _ = try core.finish(id: core.archive.active!.id, now: 2000)
            try core.start(now: 3000, consent: false)
            try core.calibrateMotion(now: 3100)
            for second in 0...3 {
                let time = 3000 + Double(second) * 1000
                core.accept(RideLocationSample(timestamp: time, latitude: 0,
                    longitude: Double(second) * 0.00009, accuracy: 4, speed: 10, speedAccuracy: 0.5), now: time)
            }
            core.acceptMotion(RideMotionAngles(left: 30, right: 40, noseUp: 15))
            hold(&core, from: 4, longitudinal: 0.9, lateral: -0.8)
            hold(&core, from: 5, longitudinal: -0.7, lateral: 0.6)
            let id = core.archive.active!.id
            var expected = core.archive
            expected.active!.gForce = RideGForceSummary(calibratedAt: 3100)
            try core.resetGForcePeaks(id: id)
            precondition(core.archive == expected)
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: folder) }
            let store = RideHistoryStore(url: folder.appendingPathComponent("rides.json"))
            try store.write(core.archive)
            let restored = try store.read()
            precondition(restored == expected)
            hold(&core, from: 6, longitudinal: 0.2, lateral: -0.15)
            hold(&core, from: 7, longitudinal: -0.1, lateral: 0.25)
            let ride = try core.finish(id: id, now: 7000)
            let peaks = ride.gForce!
            near(peaks.maxAccelerationG, 0.2); near(peaks.maxBrakingG, 0.1)
            near(peaks.maxLeftG, 0.15); near(peaks.maxRightG, 0.25)
            precondition(peaks.sampleCount == 12 && peaks.calibratedAt == 3100)
            precondition(ride.motion == expected.active!.motion)
        }
        try check("G-force reset rejects absent and stale rides without changing data or creating calibration") {
            var core = RideRecorderCore()
            let empty = core.archive
            do { try core.resetGForcePeaks(id: "missing"); preconditionFailure("Missing ride accepted") }
            catch RideRecordingError.noRide {}
            precondition(core.archive == empty)
            try core.start(now: 1000, consent: true)
            let id = core.archive.active!.id
            try core.resetGForcePeaks(id: id)
            precondition(core.archive.active!.gForce == nil)
            try core.calibrateMotion(now: 1100, recordAngles: false)
            core.acceptGForce(RideGForceReading(timestamp: 1, longitudinalG: 0.8, lateralG: -0.6))
            let before = core.archive
            do { try core.resetGForcePeaks(id: "stale"); preconditionFailure("Stale ride accepted") }
            catch RideRecordingError.wrongRide {}
            precondition(core.archive == before)
            try core.resetGForcePeaks(id: id)
            precondition(core.archive.active!.motion == nil)
            precondition(core.archive.active!.gForce == RideGForceSummary(calibratedAt: 1100))
        }
        try check("legacy rides decode without G-force and measured zero differs from missing") {
            let json = #"{"version":1,"consentGiven":true,"rides":[{"id":"old","startedAt":1000,"updatedAt":2000,"endedAt":2000,"distanceMeters":0,"sampleCount":0,"hasGaps":false,"interrupted":false}]}"#
            let legacy = try JSONDecoder().decode(RideArchive.self, from: Data(json.utf8))
            precondition(legacy.rides[0].gForce == nil)
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1100, recordAngles: false)
            precondition(core.archive.active?.gForce?.sampleCount == 0)
            core.acceptGForce(RideGForceReading(timestamp: 1, longitudinalG: 0, lateralG: 0))
            precondition(core.archive.active?.gForce?.sampleCount == 1)
            precondition(core.archive.active?.gForce?.maxAccelerationG == 0)
        }
        check("unobservable vertical orientation is unavailable and finite data stays serializable") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: down))
            precondition(tracker.gForce(acceleration: RideMotionVector(x: 0, y: 0, z: 1),
                gravity: RideMotionVector(x: 0, y: 0, z: -1), timestamp: 1) == nil)
            precondition(tracker.gForce(acceleration: RideMotionVector(x: .nan, y: 0, z: 0),
                gravity: down, timestamp: 1) == nil)
        }
        print("\(passed) G-force tests passed")
    }
}
