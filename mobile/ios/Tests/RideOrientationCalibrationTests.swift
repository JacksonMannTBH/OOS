import Foundation

@main
enum RideOrientationCalibrationTests {
    static func main() throws {
        var passed = 0
        func check(_ name: String, _ body: () throws -> Void) rethrows {
            try body(); passed += 1; print("PASS \(name)")
        }
        func near(_ actual: Double, _ expected: Double) {
            precondition(abs(actual - expected) < 0.000001, "\(actual) != \(expected)")
        }
        // Independent rigid-body fixture: rotate world vectors into the moving
        // bike, then into the tilted/canted phone. A +90-degree mount spin puts
        // the camera on the right: UIInterfaceOrientation.landscapeLeft.
        func phone(_ world: RideMotionVector, pitch: Double = 0, roll: Double = 0,
                   tilt: Double = 0, spin: Double = 0) -> RideMotionVector {
            let p = pitch * .pi / 180, r = roll * .pi / 180
            let t = tilt * .pi / 180, c = spin * .pi / 180
            let right = RideMotionVector(x: cos(r), y: -cos(p) * sin(r), z: -sin(p) * sin(r))
            let up = RideMotionVector(x: sin(r), y: cos(p) * cos(r), z: sin(p) * cos(r))
            let back = RideMotionVector(x: 0, y: -sin(p), z: cos(p))
            let x = world.dot(right), y = world.dot(up), z = world.dot(back)
            let tiltedY = y * cos(t) - z * sin(t), tiltedZ = y * sin(t) + z * cos(t)
            return RideMotionVector(x: x * cos(c) - tiltedY * sin(c),
                y: x * sin(c) + tiltedY * cos(c), z: tiltedZ)
        }
        func hold(_ tracker: inout RideMotionTracker, _ gravity: RideMotionVector,
                  at time: Double = 1) -> RideMotionAngles {
            var result: RideMotionAngles?
            for sample in 0..<4 {
                result = tracker.accept(gravity: gravity, timestamp: time + Double(sample) * 0.04)
            }
            return result!
        }
        let down = RideMotionVector(x: 0, y: -1, z: 0)
        let poses: [(RideMountOrientation, Double)] = [
            (.portrait, 0), (.landscapeLeft, 90), (.landscapeRight, -90), (.portraitUpsideDown, 180),
        ]

        check("map cone follows the visible screen's top in portrait and both landscapes") {
            let north: [(RideMountOrientation, Double)] = [
                (.portrait, 0), (.landscapeLeft, 90), (.landscapeRight, 270), (.portraitUpsideDown, 180),
            ]
            for (orientation, cameraHeading) in north {
                for desired in [0.0, 17, 90, 179, 270, 359] {
                    near(orientation.mapHeading(portraitHeading: (cameraHeading + desired).truncatingRemainder(dividingBy: 360))!, desired)
                }
                for invalid in [-1.0, .nan, .infinity] {
                    precondition(orientation.mapHeading(portraitHeading: invalid) == nil)
                }
            }
        }

        check("all screen orientations zero combined mount tilt and cant without mixing lean and wheelie") {
            for (orientation, spin) in poses {
                for tilt in [-75.0, -30, 0, 40, 75] {
                    for cant in [-25.0, 0, 25] {
                        var tracker = RideMotionTracker()
                        let zero = phone(down, tilt: tilt, spin: spin + cant)
                        precondition(tracker.calibrate(gravity: zero, orientation: orientation))
                        let baseline = hold(&tracker, zero)
                        near(baseline.left, 0); near(baseline.right, 0); near(baseline.noseUp, 0)
                        var time = 2.0
                        for roll in [-38.0, 0, 42] {
                            for pitch in [-15.0, 0, 35] {
                                let angles = hold(&tracker, phone(down, pitch: pitch, roll: roll,
                                    tilt: tilt, spin: spin + cant), at: time)
                                time += 1
                                near(angles.left, max(0, -roll)); near(angles.right, max(0, roll))
                                near(angles.noseUp, max(0, pitch))
                            }
                        }
                    }
                }
            }
        }
        check("orientation-aware G-force keeps acceleration, braking and lateral load independent") {
            for (orientation, spin) in poses {
                for tilt in [-65.0, 0, 65] {
                    for cant in [-25.0, 0, 25] {
                        var tracker = RideMotionTracker()
                        precondition(tracker.calibrate(gravity: phone(down, tilt: tilt, spin: spin + cant),
                            orientation: orientation))
                        for pitch in [-30.0, 0, 35] {
                            for roll in [-60.0, 0, 60] {
                                for direction in [-1.0, 1] {
                                    let gravity = phone(down, pitch: pitch, roll: roll, tilt: tilt, spin: spin + cant)
                                    let physical = RideMotionVector(x: direction * 0.6, y: 2, z: -direction * 0.8)
                                    let acceleration = phone(physical, pitch: pitch, roll: roll, tilt: tilt,
                                        spin: spin + cant).scaled(-1)
                                    let reading = tracker.gForce(acceleration: acceleration, gravity: gravity, timestamp: 1)!
                                    near(reading.longitudinalG, direction * 0.8)
                                    near(reading.lateralG, direction * 0.6)
                                    near(reading.rightwardLoadG, -direction * 0.6)
                                    near(reading.combinedG, 1)
                                }
                            }
                        }
                    }
                }
            }
        }
        check("flat mounts use the captured screen direction for lean, pitch and G-force") {
            for (orientation, spin) in poses {
                for tilt in [-90.0, 90] {
                    var tracker = RideMotionTracker()
                    precondition(tracker.calibrate(gravity: phone(down, tilt: tilt, spin: spin), orientation: orientation))
                    let angles = hold(&tracker, phone(down, pitch: 28, roll: -35, tilt: tilt, spin: spin))
                    near(angles.left, 35); near(angles.right, 0); near(angles.noseUp, 28)
                    let force = phone(RideMotionVector(x: 0.4, y: 1, z: -0.3), tilt: tilt, spin: spin).scaled(-1)
                    let reading = tracker.gForce(acceleration: force, gravity: phone(down, tilt: tilt, spin: spin), timestamp: 1)!
                    near(reading.longitudinalG, 0.3); near(reading.lateralG, 0.4)
                }
            }
        }
        check("gyro-guided wheelies pass vertical without turning into sideways lean in either landscape") {
            for (orientation, spin) in poses {
                for tilt in [-60.0, 0, 60] {
                    for roll in [-25.0, 0, 25] {
                        var tracker = RideMotionTracker()
                        precondition(tracker.calibrate(gravity: phone(down, tilt: tilt, spin: spin + 20), orientation: orientation))
                        for degrees in 0...180 {
                            let pitch = Double(degrees), rate = 25.0 * .pi / 180
                            let gravity = phone(down, pitch: pitch, roll: roll, tilt: tilt, spin: spin + 20)
                            let gyro = phone(RideMotionVector(x: rate, y: 0, z: 0), pitch: pitch,
                                roll: roll, tilt: tilt, spin: spin + 20)
                            if let angles = tracker.accept(gravity: gravity, timestamp: 1 + pitch * 0.04, rotationRate: gyro) {
                                precondition(angles.left <= max(0, -roll) + 0.000001)
                                precondition(angles.right <= max(0, roll) + 0.000001)
                            }
                        }
                        let inverted = hold(&tracker, phone(down, pitch: 180, roll: roll,
                            tilt: tilt, spin: spin + 20), at: 8.24)
                        near(inverted.left, max(0, -roll)); near(inverted.right, max(0, roll)); near(inverted.noseUp, 180)
                    }
                }
            }
        }
        check("calibrated directions survive sampling pauses and rejected recalibration") {
            for (orientation, spin) in poses {
                var tracker = RideMotionTracker()
                let zero = phone(down, tilt: 40, spin: spin + 15)
                precondition(tracker.calibrate(gravity: zero, orientation: orientation))
                tracker.resetSamples()
                precondition(!tracker.calibrate(gravity: RideMotionVector(x: .nan, y: 0, z: 0), orientation: .portrait))
                let angles = hold(&tracker, phone(down, pitch: 28, roll: -35, tilt: 40, spin: spin + 15))
                near(angles.left, 35); near(angles.noseUp, 28)
            }
        }
        try check("recalibrating into another orientation preserves recorded peaks and saved rides") {
            var core = RideRecorderCore()
            try core.start(now: 1000, consent: true)
            try core.calibrateMotion(now: 1100)
            core.acceptMotion(RideMotionAngles(left: 40, right: 35, noseUp: 50))
            for sample in 0...5 {
                core.acceptGForce(RideGForceReading(timestamp: 1 + Double(sample) * 0.04,
                    longitudinalG: 0.7, lateralG: -0.5))
            }
            for (orientation, spin) in poses {
                var tracker = RideMotionTracker()
                precondition(tracker.calibrate(gravity: phone(down, tilt: 40, spin: spin), orientation: orientation))
                try core.calibrateMotion(now: 1200)
                core.acceptMotion(hold(&tracker, phone(down, pitch: 10, roll: 15, tilt: 40, spin: spin)))
                near(core.archive.active!.motion!.maxLeftRollDegrees, 40)
                near(core.archive.active!.motion!.maxRightRollDegrees, 35)
                near(core.archive.active!.motion!.maxPitchDegrees, 50)
                near(core.archive.active!.gForce!.maxAccelerationG, 0.7)
                near(core.archive.active!.gForce!.maxRightG, 0.5)
            }
            let saved = try core.finish(id: core.archive.active!.id, now: 2000)
            let decoded = try JSONDecoder().decode(RideArchive.self, from: JSONEncoder().encode(core.archive))
            precondition(decoded.rides == [saved])
        }
        print("\(passed) orientation-calibration tests passed")
    }
}
