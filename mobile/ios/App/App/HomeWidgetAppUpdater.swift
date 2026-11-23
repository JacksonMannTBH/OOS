import WidgetKit

@MainActor
final class HomeWidgetAppUpdater {
    static let shared = HomeWidgetAppUpdater()
    private var didReload = false

    func configure(_ configuration: RideTrackingConfiguration, colorMode: OOSColorMode,
                   distancePalette: OOSDistancePalette) {
        // Keep preferences available for legacy Live Activity recovery.
        HomeWidgetStore.shared.configure(configuration)
        let colorChanged = HomeWidgetStore.shared.setColorMode(colorMode)
        let paletteChanged = HomeWidgetStore.shared.setDistancePalette(distancePalette)
        // Replace an existing aircraft widget with the static Ride launcher once
        // per app launch, without fetching location or aircraft data.
        guard !didReload || colorChanged || paletteChanged else { return }
        didReload = true
        WidgetCenter.shared.reloadTimelines(ofKind: HomeWidgetStore.kind)
    }
}
