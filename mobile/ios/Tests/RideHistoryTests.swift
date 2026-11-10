import Foundation

@main
enum RideHistoryTests {
    static func main() throws {
        let base = 1_800_000_000_000.0
        var passed = 0
        func check(_ title: String, _ body: () throws -> Void) rethrows {
            try body()
            passed += 1
            print("PASS \(title)")
        }
        func sample(_ second: Double, meters: Double, speed: Double = 10,
                    accuracy: Double = 4, speedAccuracy: Double = 0.5) -> RideLocationSample {
            RideLocationSample(timestamp: base + second * 1000, latitude: 0,
                longitude: meters / 111_194.9266, accuracy: accuracy, speed: speed, speedAccuracy: speedAccuracy)
        }
        func newRide() throws -> RideRecorderCore {
            var core = RideRecorderCore()
            try core.start(now: base, consent: true)
            return core
        }
        try check("recording requires consent and repeated Start resumes the same ride") {
            var core = RideRecorderCore()
            do { try core.start(now: base, consent: false); preconditionFailure("Consent bypass") }
            catch { precondition(core.archive.active == nil) }
            try core.start(now: base, consent: true)
            let id = core.archive.active!.id
            try core.start(now: base + 1000, consent: false)
            precondition(core.archive.active!.id == id)
        }
        try check("a measured 200-meter ride has distance, a confirmed peak, and duration") {
            var core = try newRide()
            for second in 0...20 {
                let point = sample(Double(second), meters: Double(second) * 10)
                core.accept(point, now: point.timestamp)
            }
            let ride = try core.finish(id: core.archive.active!.id, now: base + 20_000)
            precondition(abs(ride.distanceMeters - 200) < 0.1)
            precondition(ride.topSpeedMps == 10 && ride.durationSeconds == 20)
            precondition(!ride.hasGaps && core.archive.active == nil)
            precondition(ride.route?.count == 21)
            precondition(ride.route?.first?.startsSegment == true)
            precondition(ride.route?.last?.startsSegment == false)
            precondition(abs(ride.route!.last!.longitude - sample(20, meters: 200).longitude) < 0.000001)
        }
        try check("stationary GPS drift adds no mileage") {
            var core = try newRide()
            for second in 0...40 {
                let point = sample(Double(second), meters: second % 2 == 0 ? 0 : 7, speed: 0)
                core.accept(point, now: point.timestamp)
            }
            precondition(core.archive.active!.distanceMeters == 0)
            precondition(core.archive.active!.topSpeedMps == 0)
        }
        try check("an isolated speed spike cannot become top speed") {
            var core = try newRide()
            for second in 0...8 {
                let point = sample(Double(second), meters: Double(second) * 10, speed: second == 4 ? 90 : 10)
                core.accept(point, now: point.timestamp)
            }
            precondition(core.archive.active!.topSpeedMps == 10)
        }
        try check("invalid speed accuracy never becomes a peak") {
            var core = try newRide()
            for second in 0...5 {
                let point = sample(Double(second), meters: Double(second) * 10, speed: 70, speedAccuracy: -1)
                core.accept(point, now: point.timestamp)
            }
            precondition(core.archive.active!.topSpeedMps == nil)
        }
        try check("a position teleport is excluded from distance") {
            var core = try newRide()
            core.accept(sample(0, meters: 0), now: base)
            core.accept(sample(1, meters: 10), now: base + 1000)
            core.accept(sample(2, meters: 5000), now: base + 2000)
            core.accept(sample(3, meters: 30), now: base + 3000)
            core.accept(sample(4, meters: 40), now: base + 4000)
            precondition(core.archive.active!.distanceMeters < 21)
            precondition(core.archive.active!.hasGaps)
            precondition(core.archive.active!.route?.count == 4)
            precondition(core.archive.active!.route?[2].startsSegment == true)
        }
        try check("missing GPS time is marked partial and not bridged") {
            var core = try newRide()
            core.accept(sample(0, meters: 0), now: base)
            core.accept(sample(1, meters: 10), now: base + 1000)
            core.accept(sample(60, meters: 1000), now: base + 60_000)
            core.accept(sample(61, meters: 1010), now: base + 61_000)
            precondition(core.archive.active!.hasGaps)
            precondition(abs(core.archive.active!.distanceMeters - 20) < 0.1)
            precondition(core.archive.active!.route?.map(\.startsSegment) == [true, false, true, false])
        }
        try check("duplicate and out-of-order samples do not inflate the ride") {
            var core = try newRide()
            core.accept(sample(0, meters: 0), now: base)
            core.accept(sample(1, meters: 10), now: base + 1000)
            let before = core.archive
            core.accept(sample(1, meters: 10), now: base + 1000)
            core.accept(sample(0, meters: 0), now: base + 1000)
            precondition(core.archive == before)
        }
        try check("poor accuracy and stale points are excluded and do not bridge gaps") {
            var core = try newRide()
            core.accept(sample(0, meters: 0), now: base)
            core.accept(sample(1, meters: 1000, accuracy: 200), now: base + 1000)
            core.accept(sample(2, meters: 20), now: base + 2000)
            core.accept(sample(3, meters: 30), now: base + 200_000)
            precondition(core.archive.active!.distanceMeters == 0)
            precondition(core.archive.active!.hasGaps)
        }
        try check("cached positions before Start are ignored, but a delayed first fix is partial") {
            var core = try newRide()
            core.accept(sample(-10, meters: 0), now: base)
            precondition(core.archive.active!.sampleCount == 0 && !core.archive.active!.hasGaps)
            core.accept(sample(1, meters: 10), now: base + 1000)
            precondition(!core.archive.active!.hasGaps)
            var delayed = try newRide()
            delayed.accept(sample(30, meters: 300), now: base + 30_000)
            precondition(delayed.archive.active!.hasGaps && delayed.archive.active!.distanceMeters == 0)
        }
        try check("End Ride before GPS is valid, retrying End does not duplicate it") {
            var core = try newRide()
            let id = core.archive.active!.id
            let ride = try core.finish(id: id, now: base + 30_000)
            precondition(ride.sampleCount == 0 && ride.topSpeedMps == nil)
            _ = try core.finish(id: id, now: base + 40_000)
            precondition(core.archive.rides.count == 1)
            try core.start(now: base + 50_000, consent: false)
            do { _ = try core.finish(id: id, now: base + 60_000); preconditionFailure("Stopped wrong ride") }
            catch { precondition(core.archive.active != nil) }
        }
        try check("restart retains a partial ride only through its last saved update") {
            var core = try newRide()
            core.accept(sample(0, meters: 0), now: base)
            core.accept(sample(1, meters: 10), now: base + 1000)
            var restarted = RideRecorderCore(archive: core.archive)
            restarted.recoverInterruptedRide()
            precondition(restarted.archive.active == nil)
            let ride = restarted.archive.rides[0]
            precondition(ride.interrupted && ride.hasGaps && ride.durationSeconds == 1)
            restarted.recoverInterruptedRide()
            precondition(restarted.archive.rides.count == 1)
        }
        try check("only the latest three rides are retained and deletion persists") {
            var core = RideRecorderCore()
            var ids: [String] = []
            for i in 0...4 {
                try core.start(now: base + Double(i) * 10_000, consent: true)
                let id = core.archive.active!.id
                ids.append(id)
                _ = try core.finish(id: id, now: base + Double(i) * 10_000 + 1000)
            }
            precondition(core.archive.rides.map(\.id) == Array(ids.suffix(3).reversed()))
            try core.delete(id: ids[3])
            precondition(core.archive.rides.map(\.id) == [ids[4], ids[2]])
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: folder) }
            let store = RideHistoryStore(url: folder.appendingPathComponent("rides.json"))
            try store.write(core.archive)
            let restored = try store.read()
            precondition(restored == core.archive)
            let text = try String(contentsOf: store.url, encoding: .utf8)
            precondition(!text.contains("latitude") && !text.contains("longitude"))
        }
        try check("routes survive disk storage and legacy summaries still decode") {
            var core = try newRide()
            core.accept(sample(0, meters: 0), now: base)
            core.accept(sample(1, meters: 10), now: base + 1000)
            let id = core.archive.active!.id
            _ = try core.finish(id: id, now: base + 2000)
            let data = try JSONEncoder().encode(core.archive)
            let restored = try JSONDecoder().decode(RideArchive.self, from: data)
            precondition(restored == core.archive)
            precondition((restored.rides[0].payload["route"] as? [[String: Any]])?.count == 2)
            var legacy = try JSONSerialization.jsonObject(with: data) as! [String: Any]
            var rides = legacy["rides"] as! [[String: Any]]
            rides[0].removeValue(forKey: "route")
            legacy["rides"] = rides
            let old = try JSONDecoder().decode(RideArchive.self,
                from: JSONSerialization.data(withJSONObject: legacy))
            precondition(old.rides[0].route == nil && old.rides[0].id == id)
        }
        try check("corrupt history is not silently replaced with an empty history") {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: url) }
            try Data("bad data".utf8).write(to: url)
            do { _ = try RideHistoryStore(url: url).read(); preconditionFailure("Silently accepted corrupt file") }
            catch {
                let contents = try String(contentsOf: url, encoding: .utf8)
                precondition(contents == "bad data")
            }
        }
        print("\(passed) ride-history tests passed")
    }
}
