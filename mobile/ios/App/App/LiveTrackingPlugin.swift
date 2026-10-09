import UIKit
import Capacitor
import CoreLocation
import ActivityKit

@objc(OOSLiveTrackingPlugin)
public class LiveTrackingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OOSLiveTrackingPlugin"
    public let jsName = "OOSLiveTracking"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        Task { @MainActor in
            if #available(iOS 16.2, *) { await LiveTrackingSession.shared.clearOrphanedActivities() }
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard #available(iOS 16.2, *) else {
                call.resolve(["supported": false, "active": false, "enabled": false]); return
            }
            call.resolve(LiveTrackingSession.shared.status)
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard #available(iOS 16.2, *) else { call.reject("Live tracking requires iOS 16.2 or later."); return }
            do {
                let config = try self.configuration(call)
                try LiveTrackingSession.shared.start(config)
                call.resolve(LiveTrackingSession.shared.status)
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func configure(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard #available(iOS 16.2, *) else { call.resolve(); return }
            do {
                let config = try self.configuration(call)
                LiveTrackingSession.shared.configure(config)
                call.resolve()
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        Task { @MainActor in
            if #available(iOS 16.2, *) { await LiveTrackingSession.shared.stop() }
            call.resolve()
        }
    }

    private func configuration(_ call: CAPPluginCall) throws -> RideTrackingConfiguration {
        guard let code = call.getString("stateCode"), code.range(of: "^[A-Z]{2}$", options: .regularExpression) != nil,
              let name = call.getString("stateName"), !name.isEmpty, name.count <= 40,
              let stop = call.getDouble("stopNm"), let warning = call.getDouble("warningNm"),
              let watch = call.getDouble("watchNm"), stop.isFinite, warning.isFinite, watch.isFinite,
              stop >= 0.1, warning > stop, watch > warning, watch <= 50 else {
            throw NSError(domain: "OOS", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid live tracking settings."])
        }
        let excluded = call.getArray("excludedTails", String.self) ?? []
        guard excluded.count <= 2000 else {
            throw NSError(domain: "OOS", code: 1, userInfo: [NSLocalizedDescriptionKey: "Too many aircraft preferences."])
        }
        return RideTrackingConfiguration(stateCode: code, stateName: name,
                                         excludedTails: Set(excluded.map { $0.uppercased() }),
                                         watchNm: watch, warningNm: warning, stopNm: stop)
    }
}

@available(iOS 16.2, *)
@MainActor
private final class LiveTrackingSession: NSObject, @preconcurrency CLLocationManagerDelegate {
    static let shared = LiveTrackingSession()
    private let locationManager = CLLocationManager()
    private let network: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 12
        config.timeoutIntervalForResource = 15
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: config)
    }()
    private var activity: Activity<RideTrackingAttributes>?
    private var configuration: RideTrackingConfiguration?
    private var snapshot: RideTrackingSnapshot?
    private var position: CLLocation?
    private var timer: Timer?
    private var request: Task<Void, Never>?
    private var requestID: UUID?
    private var activityMonitor: Task<Void, Never>?
    private var publishing: Task<Void, Never>?
    private var pendingContent: RideTrackingContent?
    private var lastScheduledContent: RideTrackingContent?
    private var sessionID: UUID?
    private var lastFetch = Date.distantPast
    private var errorMessage = ""
    private var stopping = false

    override init() {
        super.init()
        // Core Location delivers callbacks on the run loop where this manager was created (main).
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        locationManager.distanceFilter = kCLDistanceFilterNone
        locationManager.activityType = .fitness
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
    }

    var status: [String: Any] {
        ["supported": true, "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
         "active": activity != nil && !stopping, "message": errorMessage]
    }

    func clearOrphanedActivities() async {
        for existing in Activity<RideTrackingAttributes>.activities where existing.id != activity?.id {
            await existing.end(nil, dismissalPolicy: .immediate)
        }
    }

    func start(_ config: RideTrackingConfiguration) throws {
        guard !stopping else { throw failure("Tracking is stopping. Please try again.") }
        guard UIApplication.shared.applicationState == .active else {
            throw failure("Open OOS to start live tracking.")
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            throw failure("Enable Live Activities for OOS in iPhone Settings.")
        }
        guard CLLocationManager.locationServicesEnabled(),
              locationManager.authorizationStatus != .denied,
              locationManager.authorizationStatus != .restricted else {
            throw failure("Allow location access for OOS in iPhone Settings to start live tracking.")
        }
        if activity != nil { configure(config); return }
        errorMessage = ""
        configuration = config
        var initial = RideTrackingContent.waiting("Waiting for current location")
        initial.stateName = config.stateName
        activity = try Activity.request(attributes: RideTrackingAttributes(stateName: config.stateName),
                                        content: ActivityContent(state: initial, staleDate: initial.validUntil),
                                        pushType: nil)
        sessionID = UUID()
        let id = sessionID
        let current = activity!
        activityMonitor = Task { [weak self] in
            for await state in current.activityStateUpdates {
                guard !Task.isCancelled, let self, self.sessionID == id else { return }
                if state == .ended || state == .dismissed {
                    await self.stop()
                    return
                }
            }
        }
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
        if locationManager.authorizationStatus == .notDetermined {
            locationManager.requestWhenInUseAuthorization()
        } else { beginLocationUpdates() }
        refresh()
    }

    func configure(_ config: RideTrackingConfiguration) {
        guard activity != nil, !stopping else { return }
        if configuration?.stateCode != config.stateCode {
            request?.cancel()
            request = nil
            requestID = nil
            snapshot = nil
            lastFetch = .distantPast
        }
        configuration = config
        refresh()
    }

    func stop() async {
        guard !stopping else { return }
        stopping = true
        let oldActivity = activity
        // Invalidate the session before awaiting so late requests can't resurrect it.
        activity = nil
        sessionID = nil
        timer?.invalidate()
        timer = nil
        request?.cancel()
        request = nil
        requestID = nil
        activityMonitor?.cancel()
        activityMonitor = nil
        publishing?.cancel()
        publishing = nil
        pendingContent = nil
        lastScheduledContent = nil
        locationManager.stopUpdatingLocation()
        locationManager.allowsBackgroundLocationUpdates = false
        snapshot = nil
        position = nil
        configuration = nil
        lastFetch = .distantPast
        if let oldActivity { await oldActivity.end(nil, dismissalPolicy: .immediate) }
        stopping = false
    }

    private func beginLocationUpdates() {
        guard activity != nil, !stopping else { return }
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.startUpdatingLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard activity != nil else { return }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: beginLocationUpdates()
        case .denied, .restricted:
            errorMessage = "Live tracking stopped because location access is unavailable."
            Task { await stop() }
        default: break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard activity != nil, let location = locations.last, location.horizontalAccuracy >= 0,
              location.horizontalAccuracy <= 100, abs(location.timestamp.timeIntervalSinceNow) <= 30 else { return }
        position = location
        refresh()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard activity != nil else { return }
        position = nil
        refresh()
    }

    private func refresh() {
        guard let config = configuration, let id = sessionID, !stopping else { return }
        publish()
        guard request == nil, Date().timeIntervalSince(lastFetch) >= 15 else { return }
        lastFetch = Date()
        var url = URLComponents(string: "https://outofsight.live/api/aircraft")!
        // The phone calculates distance locally; coordinates never enter this request.
        url.queryItems = [URLQueryItem(name: "state", value: config.stateCode),
                          URLQueryItem(name: "_", value: String(Int(Date().timeIntervalSince1970 * 1000)))]
        let stateCode = config.stateCode
        let fetchID = UUID()
        requestID = fetchID
        request = Task { [weak self] in
            guard let self else { return }
            var backgroundTask = UIBackgroundTaskIdentifier.invalid
            backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "Refresh live tracking") { [weak self] in
                if self?.requestID == fetchID { self?.request?.cancel() }
            }
            defer {
                if backgroundTask != .invalid { UIApplication.shared.endBackgroundTask(backgroundTask) }
                if self.requestID == fetchID { self.request = nil; self.requestID = nil }
            }
            do {
                let (data, response) = try await self.network.data(from: url.url!)
                guard !Task.isCancelled, self.sessionID == id, self.requestID == fetchID,
                      self.configuration?.stateCode == stateCode,
                      (response as? HTTPURLResponse)?.statusCode == 200 else { return }
                let result = try JSONDecoder().decode(RideTrackingSnapshot.self, from: data)
                self.snapshot = result
                self.publish()
            } catch {
                // Don't advance the freshness deadline on a failed request.
                if !Task.isCancelled, self.sessionID == id { self.publish() }
            }
        }
    }

    private func publish() {
        guard let current = activity, let config = configuration, let id = sessionID else { return }
        var content = RideTrackingCalculator.summarize(snapshot: snapshot,
            lat: position?.coordinate.latitude, lon: position?.coordinate.longitude,
            locationDate: position?.timestamp, configuration: config)
        content.stateName = config.stateName
        // Updating every GPS callback is unnecessary; distance is shown to one decimal.
        let previous = lastScheduledContent ?? current.content.state
        if previous.aircraft == content.aircraft, previous.rideState == content.rideState,
           previous.message == content.message,
           previous.stateName == content.stateName,
           rounded(previous.distanceNm) == rounded(content.distanceNm),
           abs(previous.validUntil.timeIntervalSince(content.validUntil)) < 10 { return }
        pendingContent = content
        lastScheduledContent = content
        guard publishing == nil else { return }
        publishing = Task { [weak self] in
            guard let self else { return }
            defer { if self.sessionID == id { self.publishing = nil } }
            // Serialize ActivityKit updates so an older GPS callback can't replace a newer result.
            while !Task.isCancelled, self.sessionID == id, let next = self.pendingContent {
                self.pendingContent = nil
                await current.update(ActivityContent(state: next, staleDate: next.validUntil))
            }
        }
    }

    private func rounded(_ distance: Double?) -> Double? { distance.map { ($0 * 10).rounded() / 10 } }
    private func failure(_ text: String) -> NSError {
        NSError(domain: "OOS", code: 1, userInfo: [NSLocalizedDescriptionKey: text])
    }
}
