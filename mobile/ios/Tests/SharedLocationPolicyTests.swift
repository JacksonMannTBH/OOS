import Foundation

@main
enum SharedLocationPolicyTests {
    static func main() {
        var demand = SharedLocationDemand()
        demand.subscribe("map", background: false)
        precondition(demand.needsUpdates(foreground: true))
        precondition(!demand.needsUpdates(foreground: false))
        demand.subscribe("ride", background: true)
        demand.subscribe("live", background: true)
        demand.unsubscribe("map")
        precondition(demand.needsUpdates(foreground: false))
        demand.unsubscribe("ride")
        precondition(demand.needsBackground)
        demand.unsubscribe("live")
        precondition(!demand.needsUpdates(foreground: true))
        demand.subscribe("map", background: false)
        precondition(demand.needsUpdates(foreground: true) && !demand.needsBackground)
        let now = Date()
        func accepts(age: Double = 0, accuracy: Double = 10, previous: Date? = nil) -> Bool {
            SharedLocationPolicy.accepts(latitude: 47, longitude: -122, accuracy: accuracy,
                timestamp: now.addingTimeInterval(-age), now: now, previous: previous)
        }
        precondition(accepts())
        precondition(!accepts(age: 31))
        precondition(!accepts(age: -6))
        precondition(!accepts(accuracy: -1))
        precondition(!accepts(accuracy: 101))
        precondition(!accepts(accuracy: .nan))
        precondition(!accepts(previous: now))
        precondition(!accepts(age: 2, previous: now.addingTimeInterval(-1)))
        precondition(accepts(previous: now.addingTimeInterval(-1)))
        print("PASS shared location ownership, foreground/background demand, freshness, accuracy, and sample ordering")
    }
}
