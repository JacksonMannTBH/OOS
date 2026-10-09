import Foundation
import CoreLocation

@MainActor
enum HomeWidgetRefresh {
    static func refresh(configuration: RideTrackingConfiguration, forWidget: Bool) async -> Bool {
        let locator = HomeWidgetLocationRequest()
        guard let location = await locator.location(forWidget: forWidget), !Task.isCancelled else { return false }
        var url = URLComponents(string: "https://outofsight.live/api/aircraft")!
        // Distance is calculated on-device; the request contains no rider coordinates.
        url.queryItems = [URLQueryItem(name: "state", value: configuration.stateCode),
                          URLQueryItem(name: "_", value: String(Int(Date().timeIntervalSince1970 * 1000)))]
        let options = URLSessionConfiguration.ephemeral
        options.timeoutIntervalForRequest = 10
        options.timeoutIntervalForResource = 12
        options.requestCachePolicy = .reloadIgnoringLocalCacheData
        let session = URLSession(configuration: options)
        defer { session.invalidateAndCancel() }
        do {
            let (data, response) = try await session.data(from: url.url!)
            guard !Task.isCancelled, (response as? HTTPURLResponse)?.statusCode == 200 else { return false }
            let snapshot = try JSONDecoder().decode(RideTrackingSnapshot.self, from: data)
            var content = RideTrackingCalculator.summarize(snapshot: snapshot,
                lat: location.coordinate.latitude, lon: location.coordinate.longitude,
                locationDate: location.timestamp, configuration: configuration)
            content.stateName = configuration.stateName
            return HomeWidgetStore.shared.publish(content, for: configuration)
        } catch { return false }
    }
}

@MainActor
private final class HomeWidgetLocationRequest: NSObject, @preconcurrency CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation?, Never>?
    private var timeout: Task<Void, Never>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    }

    func location(forWidget: Bool) async -> CLLocation? {
        guard CLLocationManager.locationServicesEnabled(),
              manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways,
              !forWidget || manager.isAuthorizedForWidgetUpdates else { return nil }
        return await withCheckedContinuation { continuation in
            self.continuation = continuation
            timeout = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 8_000_000_000)
                guard !Task.isCancelled else { return }
                self?.finish(nil)
            }
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let valid = locations.last { $0.horizontalAccuracy >= 0 && $0.horizontalAccuracy <= 100 &&
            abs($0.timestamp.timeIntervalSinceNow) <= 30 }
        finish(valid)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { finish(nil) }

    private func finish(_ location: CLLocation?) {
        timeout?.cancel()
        timeout = nil
        manager.stopUpdatingLocation()
        continuation?.resume(returning: location)
        continuation = nil
    }
}
