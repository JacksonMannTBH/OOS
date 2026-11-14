import UIKit
import CoreLocation
import Capacitor
import WebKit

@MainActor
final class SharedLocationService: NSObject, @preconcurrency CLLocationManagerDelegate {
    static let shared = SharedLocationService()
    let manager = CLLocationManager()
    private struct Client {
        let background: Bool
        let locations: ([CLLocation]) -> Void
        let error: (Error) -> Void
        let authorization: () -> Void
    }
    private var clients: [String: Client] = [:]
    private var demand = SharedLocationDemand()
    private var latest: CLLocation?
    private var running = false
    private var backgroundSession: AnyObject?
    private var observers: [NSObjectProtocol] = []

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone
        manager.activityType = .automotiveNavigation
        manager.pausesLocationUpdatesAutomatically = false
        manager.showsBackgroundLocationIndicator = true
        for name in [UIApplication.didBecomeActiveNotification, UIApplication.didEnterBackgroundNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.synchronize() }
            })
        }
    }

    func subscribe(_ id: String, background: Bool, locations: @escaping ([CLLocation]) -> Void,
                   error: @escaping (Error) -> Void, authorization: @escaping () -> Void = {}) {
        let isNew = clients[id] == nil
        clients[id] = Client(background: background, locations: locations, error: error, authorization: authorization)
        demand.subscribe(id, background: background)
        synchronize()
        if isNew, let latest, abs(latest.timestamp.timeIntervalSinceNow) <= 5,
           background || UIApplication.shared.applicationState == .active {
            locations([latest])
        }
    }

    func unsubscribe(_ id: String) {
        clients.removeValue(forKey: id)
        demand.unsubscribe(id)
        synchronize()
    }

    private func synchronize() {
        let foreground = UIApplication.shared.applicationState == .active
        let needed = demand.needsUpdates(foreground: foreground)
        guard needed else {
            manager.stopUpdatingLocation()
            running = false
            manager.allowsBackgroundLocationUpdates = false
            endBackgroundSession()
            return
        }
        switch manager.authorizationStatus {
        case .notDetermined:
            if foreground { manager.requestWhenInUseAuthorization() }
            return
        case .denied, .restricted:
            latest = nil
            manager.stopUpdatingLocation()
            running = false
            manager.allowsBackgroundLocationUpdates = false
            endBackgroundSession()
            for client in Array(clients.values) { client.error(CLError(.denied)) }
            return
        default: break
        }
        if demand.needsBackground {
            if #available(iOS 17.0, *), backgroundSession == nil {
                backgroundSession = CLBackgroundActivitySession()
            }
        } else { endBackgroundSession() }
        manager.allowsBackgroundLocationUpdates = demand.needsBackground
        if !running {
            manager.startUpdatingLocation()
            running = true
        }
    }

    private func endBackgroundSession() {
        if #available(iOS 17.0, *) { (backgroundSession as? CLBackgroundActivitySession)?.invalidate() }
        backgroundSession = nil
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        for client in Array(clients.values) { client.authorization() }
        synchronize()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let now = Date()
        var accepted: [CLLocation] = []
        for location in locations.sorted(by: { $0.timestamp < $1.timestamp }) {
            guard SharedLocationPolicy.accepts(latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude, accuracy: location.horizontalAccuracy,
                timestamp: location.timestamp, now: now, previous: latest?.timestamp) else { continue }
            latest = location
            accepted.append(location)
        }
        guard !accepted.isEmpty else { return }
        let foreground = UIApplication.shared.applicationState == .active
        for client in Array(clients.values) where client.background || foreground { client.locations(accepted) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let foreground = UIApplication.shared.applicationState == .active
        for client in Array(clients.values) where client.background || foreground { client.error(error) }
    }
}

@objc(OOSLocationPlugin)
public class SharedLocationPlugin: CAPPlugin, CAPBridgedPlugin, @preconcurrency CLLocationManagerDelegate {
    public let identifier = "OOSLocationPlugin"
    public let jsName = "OOSLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "watchPosition", returnType: CAPPluginReturnCallback),
        CAPPluginMethod(name: "clearWatch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watchHeading", returnType: CAPPluginReturnCallback),
        CAPPluginMethod(name: "clearHeading", returnType: CAPPluginReturnPromise)
    ]
    private var calls: [String: CAPPluginCall] = [:]
    private var headingCalls: [String: CAPPluginCall] = [:]
    private var compass: CLLocationManager?
    private var loadingObservation: NSKeyValueObservation?

    public override func load() {
        loadingObservation = bridge?.webView?.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
            if view.isLoading { Task { @MainActor in self?.clearAll() } }
        }
    }

    @objc func watchHeading(_ call: CAPPluginCall) {
        Task { @MainActor [self] in
            guard CLLocationManager.headingAvailable(), let id = call.callbackId else {
                call.reject("Compass unavailable."); return
            }
            call.keepAlive = true
            bridge?.saveCall(call)
            headingCalls[id] = call
            if compass == nil {
                let manager = CLLocationManager()
                manager.delegate = self
                manager.headingFilter = 2
                manager.headingOrientation = .portrait
                compass = manager
            }
            compass?.startUpdatingHeading()
        }
    }

    @objc func clearHeading(_ call: CAPPluginCall) {
        Task { @MainActor [self] in
            if let id = call.getString("id") { removeHeading(id) }
            call.resolve()
        }
    }

    @MainActor private func removeHeading(_ id: String) {
        if let saved = headingCalls.removeValue(forKey: id) {
            saved.keepAlive = false
            bridge?.releaseCall(saved)
        }
        if headingCalls.isEmpty { compass?.stopUpdatingHeading() }
    }

    @MainActor public func locationManager(_ manager: CLLocationManager, didUpdateHeading heading: CLHeading) {
        guard heading.headingAccuracy >= 0 else { return }
        let degrees = heading.trueHeading >= 0 ? heading.trueHeading : heading.magneticHeading
        for call in Array(headingCalls.values) { call.resolve(["heading": degrees]) }
    }

    @objc func watchPosition(_ call: CAPPluginCall) {
        Task { @MainActor [self] in
            guard let id = call.callbackId else { call.reject("Missing location callback identifier."); return }
            call.keepAlive = true
            self.bridge?.saveCall(call)
            self.calls[id] = call
            SharedLocationService.shared.subscribe("ui:" + id, background: false, locations: { [weak self] locations in
                guard let call = self?.calls[id], let location = locations.last else { return }
                call.resolve(["position": [
                    "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
                    "coords": ["latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude,
                        "accuracy": location.horizontalAccuracy, "altitude": location.altitude,
                        "altitudeAccuracy": location.verticalAccuracy >= 0 ? location.verticalAccuracy as Any : NSNull(),
                        "speed": location.speed >= 0 ? location.speed as Any : NSNull(),
                        "heading": location.course >= 0 ? location.course as Any : NSNull(),
                        "course": location.course >= 0 ? location.course as Any : NSNull(),
                        "magneticHeading": NSNull(), "trueHeading": NSNull(), "headingAccuracy": NSNull()]
                ]])
            }, error: { [weak self] error in
                let denied = (error as? CLError)?.code == .denied
                self?.calls[id]?.resolve(["error": ["code": denied ? 1 : 2, "message": error.localizedDescription]])
            })
        }
    }

    @objc func clearWatch(_ call: CAPPluginCall) {
        Task { @MainActor in
            if let id = call.getString("id") { self.clear(id) }
            call.resolve()
        }
    }

    @MainActor private func clear(_ id: String) {
        SharedLocationService.shared.unsubscribe("ui:" + id)
        if let saved = calls.removeValue(forKey: id) {
            saved.keepAlive = false
            bridge?.releaseCall(saved)
        }
    }
    @MainActor private func clearAll() {
        for id in Array(calls.keys) { clear(id) }
        for id in Array(headingCalls.keys) { removeHeading(id) }
    }
}
