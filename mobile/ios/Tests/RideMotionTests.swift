import Foundation

@main
enum RideMotionTests {
    static func main() throws {
        var passed = 0
        func check(_ title: String, _ body: () throws -> Void) rethrows {
            try body(); passed += 1; print("PASS \(title)")
        }
        func gravity(mount: Double = 0, roll: Double = 0, pitch: Double = 0) -> RideMotionVector {
            let m = mount * .pi / 180, r = roll * .pi / 180, p = pitch * .pi / 180
            // Independent fixture: world vertical expressed in bike axes, then
            // rotated into a portrait phone tilted by the mount angle.
            let bikeX = -sin(r) * cos(p), bikeY = cos(r) * cos(p), bikeZ = sin(p)
            return RideMotionVector(x: -bikeX, y: -(cos(m) * bikeY + sin(m) * bikeZ),
                z: -(sin(m) * bikeY - cos(m) * bikeZ))
        }
        func sustained(_ tracker: inout RideMotionTracker, _ sample: RideMotionVector,
                       at time: Double = 1) -> RideMotionAngles? {
            var angles: RideMotionAngles?
            for i in 0..<4 { angles = tracker.accept(gravity: sample, timestamp: time + Double(i) * 0.04) }
            return angles
        }
        check("uncalibrated motion never produces angle records") {
            var tracker = RideMotionTracker()
            precondition(sustained(&tracker, gravity(roll: 40)) == nil)
        }
        check("mount tilt is zeroed and combined roll/pitch remain separate") {
            for mount in [-170.0, -90, -80, -35, 0, 55, 80, 90, 170] {
                for roll in [-38.0, 0, 42] {
                    for pitch in [-15.0, 0, 35] {
                        var tracker = RideMotionTracker()
                        precondition(tracker.calibrate(gravity: gravity(mount: mount)))
                        let result = sustained(&tracker, gravity(mount: mount, roll: roll, pitch: pitch))!
                        precondition(abs(result.left - max(0, -roll)) < 0.001)
                        precondition(abs(result.right - max(0, roll)) < 0.001)
                        precondition(abs(result.noseUp - max(0, pitch)) < 0.001)
                    }
                }
            }
        }
        check("an isolated spike cannot establish a peak") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: gravity()))
            for i in 0..<12 {
                let value = tracker.accept(gravity: gravity(roll: i == 5 ? 75 : 0, pitch: i == 5 ? 60 : 0),
                    timestamp: 1 + Double(i) * 0.04)
                if let value { precondition(value.right == 0 && value.noseUp == 0) }
            }
        }
        check("gaps and invalid samples reset confirmation; duplicates never count") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: gravity()))
            precondition(sustained(&tracker, gravity(roll: 20)) != nil)
            precondition(tracker.accept(gravity: gravity(roll: 60), timestamp: 3) == nil)
            precondition(tracker.accept(gravity: gravity(roll: 60), timestamp: 3) == nil)
            precondition(tracker.accept(gravity: RideMotionVector(x: .nan, y: 0, z: 0), timestamp: 3.04) == nil)
            precondition(tracker.accept(gravity: gravity(roll: 60), timestamp: 3.08) == nil)
        }
        check("side-canted starting mounts are zeroed without mixing roll and pitch") {
            for cant in [-60.0, -30, 30, 60] {
                let radians = cant * .pi / 180
                func mounted(_ sample: RideMotionVector) -> RideMotionVector {
                    RideMotionVector(x: sample.x * cos(radians) - sample.y * sin(radians),
                        y: sample.x * sin(radians) + sample.y * cos(radians), z: sample.z)
                }
                var tracker = RideMotionTracker()
                precondition(tracker.calibrate(gravity: mounted(gravity())))
                let zero = sustained(&tracker, mounted(gravity()))!
                precondition(zero.left < 0.001 && zero.right < 0.001 && zero.noseUp < 0.001)
                let angles = sustained(&tracker, mounted(gravity(roll: -35, pitch: 28)), at: 2)!
                precondition(abs(angles.left - 35) < 0.001 && angles.right == 0)
                precondition(abs(angles.noseUp - 28) < 0.001)
            }
        }
        check("flat and vertical-right-axis poses calibrate to zero without singularities") {
            for gravity in [RideMotionVector(x: 0, y: 0, z: -1),
                            RideMotionVector(x: -1, y: 0, z: 0),
                            RideMotionVector(x: 1, y: 0.001, z: 0)] {
                var tracker = RideMotionTracker()
                precondition(tracker.calibrate(gravity: gravity))
                let zero = sustained(&tracker, gravity)!
                precondition(zero.left < 0.001 && zero.right < 0.001 && zero.noseUp < 0.001)
            }
        }
        check("invalid calibration samples cannot replace a valid zero") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: gravity()))
            for invalid in [RideMotionVector(x: 0, y: 0, z: 0),
                            RideMotionVector(x: .nan, y: 0, z: 0),
                            RideMotionVector(x: .infinity, y: 0, z: 0)] {
                precondition(!tracker.calibrate(gravity: invalid))
                precondition(tracker.calibrated)
            }
            let angles = sustained(&tracker, gravity(roll: 30, pitch: 15))!
            precondition(abs(angles.right - 30) < 0.001 && abs(angles.noseUp - 15) < 0.001)
        }
        check("nose-down tilt is not counted as nose-up; near vertical pitch does not create roll") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: gravity()))
            let down = sustained(&tracker, gravity(pitch: -25))!
            precondition(down.noseUp == 0)
            let vertical = sustained(&tracker, gravity(pitch: 89), at: 2)!
            precondition(abs(vertical.noseUp - 89) < 0.001 && vertical.left == 0 && vertical.right == 0)
        }
        check("backward pitch passes vertical and reaches 180 without becoming side roll") {
            for mount in [-80.0, 0, 55, 90] {
                for roll in [-30.0, 0, 30] {
                    var tracker = RideMotionTracker()
                    precondition(tracker.calibrate(gravity: gravity(mount: mount)))
                    let m = mount * .pi / 180, r = roll * .pi / 180
                    let rate = 25.0 * .pi / 180
                    let gyro = RideMotionVector(x: rate * cos(r), y: rate * sin(r) * cos(m),
                        z: rate * sin(r) * sin(m))
                    for degrees in 0...180 {
                        if let angles = tracker.accept(gravity: gravity(mount: mount, roll: roll, pitch: Double(degrees)),
                            timestamp: 1 + Double(degrees) * 0.04, rotationRate: gyro) {
                            precondition(angles.left <= max(0, -roll) + 0.001)
                            precondition(angles.right <= max(0, roll) + 0.001)
                            precondition(abs(angles.noseUp - Double(max(0, degrees - 3))) < 0.001)
                        }
                    }
                    let inverted = sustained(&tracker, gravity(mount: mount, roll: roll, pitch: 180), at: 8.24)!
                    precondition(abs(inverted.noseUp - 180) < 0.001)
                }
            }
        }
        check("a complete backward rotation passes the signed angle boundary without folding") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: gravity()))
            for degrees in 0...360 {
                let angles = tracker.accept(gravity: gravity(pitch: Double(degrees)),
                    timestamp: 1 + Double(degrees) * 0.04,
                    rotationRate: RideMotionVector(x: 25 * .pi / 180, y: 0, z: 0))
                if let angles {
                    precondition(abs(angles.noseUp - Double(max(0, degrees - 3))) < 0.001)
                    precondition(angles.left < 0.001 && angles.right < 0.001)
                }
            }
            let fullTurn = sustained(&tracker, gravity(), at: 15.44)!
            precondition(abs(fullTurn.noseUp - 360) < 0.001)
            tracker.resetSamples()
            let resumed = sustained(&tracker, gravity(), at: 16)!
            precondition(resumed.noseUp < 0.001, "An inactive interval must not preserve an inferred full-turn count")
        }
        check("sideways inversion remains roll and does not become a wheelie") {
            for direction in [-1.0, 1] {
                var tracker = RideMotionTracker()
                precondition(tracker.calibrate(gravity: gravity()))
                for degrees in 0...180 {
                    if let angles = tracker.accept(gravity: gravity(roll: direction * Double(degrees)),
                        timestamp: 1 + Double(degrees) * 0.04,
                        rotationRate: RideMotionVector(x: 0, y: 0, z: -direction * 25 * .pi / 180)) {
                        precondition(angles.noseUp < 0.001)
                    }
                }
                let inverted = sustained(&tracker, gravity(roll: direction * 180), at: 8.24)!
                precondition(abs((direction > 0 ? inverted.right : inverted.left) - 180) < 0.001)
                precondition(inverted.noseUp < 0.001)
            }
        }
        check("reversing around vertical does not accumulate a false rotation") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: gravity()))
            let path = Array(0...100) + Array((80...99).reversed()) + Array(81...110) + Array((0...109).reversed())
            for (index, degrees) in path.enumerated() {
                let prior = index > 0 ? path[index - 1] : 0
                if let angles = tracker.accept(gravity: gravity(pitch: Double(degrees)),
                    timestamp: 1 + Double(index) * 0.04,
                    rotationRate: RideMotionVector(x: Double(degrees - prior) / 0.04 * .pi / 180, y: 0, z: 0)) {
                    precondition(angles.noseUp <= 110.001 && angles.left < 0.001 && angles.right < 0.001)
                }
            }
            let zero = sustained(&tracker, gravity(), at: 1 + Double(path.count) * 0.04)!
            precondition(zero.noseUp < 0.001 && zero.left < 0.001 && zero.right < 0.001)
        }
        check("gravity noise at vertical cannot create a false roll peak") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: gravity()))
            for degrees in 0...180 {
                var sample = gravity(roll: 30, pitch: Double(degrees))
                if degrees == 90 { sample = RideMotionVector(x: 0.00001, y: -0.00001, z: 1) }
                let rate = 25.0 * .pi / 180
                if let angles = tracker.accept(gravity: sample, timestamp: 1 + Double(degrees) * 0.04,
                    rotationRate: RideMotionVector(x: rate * cos(.pi / 6), y: rate * sin(.pi / 6), z: 0)) {
                    precondition(angles.right <= 30.001 && angles.left < 0.001)
                }
            }
            let inverted = sustained(&tracker, gravity(roll: 30, pitch: 180), at: 8.24)!
            precondition(abs(inverted.noseUp - 180) < 0.001 && abs(inverted.right - 30) < 0.001)
        }
        try check("pitch above 90 survives the finished summary and archive") {
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1000)
            core.acceptMotion(RideMotionAngles(left: 0, right: 0, noseUp: 180))
            let finished = try core.finish(id: core.archive.active!.id, now: 2000)
            precondition(finished.motion?.maxPitchDegrees == 180)
            let decoded = try JSONDecoder().decode(RideArchive.self, from: JSONEncoder().encode(core.archive))
            precondition(decoded.rides[0].motion?.maxPitchDegrees == 180)
            precondition((decoded.rides[0].payload["motion"] as? [String: Any])?["maxPitchDegrees"] as? Double == 180)
        }
        try check("peaks require calibration, survive recalibration and disk storage, and reset for a new ride") {
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            core.acceptMotion(RideMotionAngles(left: 50, right: 40, noseUp: 35))
            precondition(core.archive.active?.motion == nil)
            try core.calibrateMotion(now: 1100)
            core.acceptMotion(RideMotionAngles(left: 32, right: 24, noseUp: 30))
            try core.calibrateMotion(now: 1200)
            core.acceptMotion(RideMotionAngles(left: 20, right: 35, noseUp: 12))
            let id = core.archive.active!.id
            let finished = try core.finish(id: id, now: 3000)
            precondition(finished.motion?.maxLeftRollDegrees == 32 && finished.motion?.maxRightRollDegrees == 35)
            precondition(finished.motion?.maxPitchDegrees == 30 && finished.motion?.sampleCount == 2)
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: folder) }
            let store = RideHistoryStore(url: folder.appendingPathComponent("rides.json"))
            try store.write(core.archive)
            let restored = try store.read()
            precondition(restored == core.archive)
            precondition((restored.rides[0].payload["motion"] as? [String: Any])?["maxPitchDegrees"] as? Double == 30)
            try core.start(now: 4000, consent: false)
            precondition(core.archive.active?.motion == nil)
        }
        try check("reset clears only active peaks, persists, and accepts smaller new peaks") {
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1100)
            core.acceptMotion(RideMotionAngles(left: 32, right: 35, noseUp: 30))
            let previous = try core.finish(id: core.archive.active!.id, now: 2000)
            try core.start(now: 3000, consent: false)
            try core.calibrateMotion(now: 3100)
            core.acceptMotion(RideMotionAngles(left: 40, right: 45, noseUp: 50))
            core.accept(RideLocationSample(timestamp: 3200, latitude: 47.5, longitude: -122.26,
                accuracy: 5, speed: 10, speedAccuracy: 1), now: 3200)
            core.accept(RideLocationSample(timestamp: 3500, latitude: 47.50003, longitude: -122.26,
                accuracy: 5, speed: 10, speedAccuracy: 1), now: 3500)
            let before = core.archive.active!
            precondition(before.topSpeedMps == 10 && before.distanceMeters > 0)
            do {
                try core.resetMotionPeaks(id: previous.id)
                preconditionFailure("A stale ride must not reset the active ride")
            } catch RideRecordingError.wrongRide {}
            precondition(core.archive.active == before)
            try core.resetMotionPeaks(id: before.id)
            var expected = before
            expected.motion = RideMotionSummary(calibratedAt: 3100)
            precondition(core.archive.active == expected)
            precondition(core.archive.rides == [previous])
            let restored = try JSONDecoder().decode(RideArchive.self, from: JSONEncoder().encode(core.archive))
            precondition(restored == core.archive)
            core.acceptMotion(RideMotionAngles(left: 11, right: 12, noseUp: 13))
            let finished = try core.finish(id: before.id, now: 4000)
            precondition(finished.motion?.maxLeftRollDegrees == 11)
            precondition(finished.motion?.maxRightRollDegrees == 12)
            precondition(finished.motion?.maxPitchDegrees == 13 && finished.motion?.sampleCount == 1)
            do {
                try core.resetMotionPeaks(id: before.id)
                preconditionFailure("Finished rides must not be reset")
            } catch RideRecordingError.noRide {}
        }
        check("reset discards peak candidates while keeping calibration") {
            var tracker = RideMotionTracker()
            precondition(tracker.calibrate(gravity: gravity()))
            precondition(sustained(&tracker, gravity(roll: 40)) != nil)
            tracker.resetSamples(preservingOrientation: true)
            precondition(tracker.calibrated)
            for index in 0..<3 {
                precondition(tracker.accept(gravity: gravity(roll: 10), timestamp: 1.16 + Double(index) * 0.04) == nil)
            }
            let angles = tracker.accept(gravity: gravity(roll: 10), timestamp: 1.28)!
            precondition(abs(angles.right - 10) < 0.001)
        }
        try check("legacy archives decode without motion data") {
            let json = #"{"version":1,"consentGiven":true,"rides":[{"id":"old","startedAt":1000,"updatedAt":2000,"endedAt":2000,"distanceMeters":0,"sampleCount":0,"hasGaps":false,"interrupted":false}]}"#
            let archive = try JSONDecoder().decode(RideArchive.self, from: Data(json.utf8))
            precondition(archive.rides[0].motion == nil && archive.rides[0].id == "old")
        }
        print("\(passed) ride-motion tests passed")
    }
}
