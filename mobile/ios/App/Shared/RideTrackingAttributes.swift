import ActivityKit

@available(iOS 16.2, *)
struct RideTrackingAttributes: ActivityAttributes {
    typealias ContentState = RideTrackingContent
    var stateName: String
}
