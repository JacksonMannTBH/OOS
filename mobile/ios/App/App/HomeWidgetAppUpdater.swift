import UIKit
import WidgetKit

@MainActor
final class HomeWidgetAppUpdater {
    static let shared = HomeWidgetAppUpdater()
    private var request: Task<Void, Never>?
    private var lastReload = Date.distantPast

    func configure(_ configuration: RideTrackingConfiguration) {
        let changed = HomeWidgetStore.shared.configure(configuration)
        if changed { reload() }
        guard UIApplication.shared.applicationState == .active else { return }
        request?.cancel()
        request = Task {
            if await HomeWidgetRefresh.refresh(configuration: configuration, forWidget: false) {
                reload()
            }
        }
    }

    func publish(_ content: RideTrackingContent, configuration: RideTrackingConfiguration) {
        guard HomeWidgetStore.shared.publish(content, for: configuration) else { return }
        // Live Tracking can emit GPS updates every second; don't flood WidgetKit.
        if Date().timeIntervalSince(lastReload) >= 60 { reload() }
    }

    private func reload() {
        lastReload = Date()
        WidgetCenter.shared.reloadTimelines(ofKind: HomeWidgetStore.kind)
    }
}
