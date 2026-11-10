import WidgetKit

@MainActor
final class HomeWidgetAppUpdater {
    static let shared = HomeWidgetAppUpdater()
    private var didReload = false

    func configure(_ configuration: RideTrackingConfiguration) {
        // Keep preferences available for legacy Live Activity recovery.
        HomeWidgetStore.shared.configure(configuration)
        // Replace an existing aircraft widget with the static Ride launcher once
        // per app launch, without fetching location or aircraft data.
        guard !didReload else { return }
        didReload = true
        WidgetCenter.shared.reloadTimelines(ofKind: HomeWidgetStore.kind)
    }
}
