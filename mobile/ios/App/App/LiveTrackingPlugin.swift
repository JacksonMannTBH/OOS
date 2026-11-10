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
            if #available(iOS 16.2, *) { LiveTrackingSession.shared.recoverExistingActivity() }
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard #available(iOS 16.2, *) else {
                call.resolve(["supported": false, "active": false, "enabled": false]); return
            }
            LiveTrackingSession.shared.recoverExistingActivity()
            call.resolve(LiveTrackingSession.shared.status)
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard #available(iOS 16.2, *) else { call.reject("Live tracking requires iOS 16.2 or later."); return }
            do {
                let config = try self.configuration(call)
                HomeWidgetAppUpdater.shared.configure(config)
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
                HomeWidgetAppUpdater.shared.configure(config)
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
final class LiveTrackingSession: NSObject, @preconcurrency CLLocationManagerDelegate {
    static let shared = LiveTrackingSession()
    private var locationManager: CLLocationManager { SharedLocationService.shared.manager }
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
    private var startedAt: Date?
    private var lifecycleObservers: [NSObjectProtocol] = []
    private var lastHeartbeat = Date.distantPast
    private let persistence = LiveTrackingPersistence.shared

    override init() {
        super.init()
        persistence.record("process_started")
        for name in [UIApplication.didEnterBackgroundNotification, UIApplication.didBecomeActiveNotification,
                     UIApplication.protectedDataWillBecomeUnavailableNotification] {
            lifecycleObservers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] note in
                Task { @MainActor in
                    guard let self else { return }
                    self.persistence.record("app_lifecycle", detail: note.name.rawValue)
                    if note.name == UIApplication.didBecomeActiveNotification {
                        self.recoverExistingActivity()
                        if self.sessionID != nil {
                            self.beginLocationUpdates()
                            self.refresh()
                        }
                    }
                }
            })
        }
    }

    var status: [String: Any] {
        ["supported": true, "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
         "active": sessionID != nil && activity != nil && !stopping, "message": errorMessage]
    }

    func recoverExistingActivity(fallbackConfiguration: RideTrackingConfiguration? = nil) {
        guard sessionID == nil, !stopping else { return }
        let saved = persistence.load()
        let activities = Activity<RideTrackingAttributes>.activities
        if saved?.stopReason == LiveTrackingStopReason.appClosed.rawValue, !activities.isEmpty {
            // A force-close can interrupt ActivityKit's asynchronous dismissal.
            Task { await self.stop(reason: .appClosed) }
            return
        }
        let identities = activities.map { RecoverableLiveActivity(id: $0.id,
            canUpdate: $0.activityState == .active || $0.activityState == .stale,
            updatedAt: $0.content.state.updatedAt) }
        guard let selectedID = LiveTrackingRecovery.activityID(session: saved, activities: identities),
              let existing = activities.first(where: { $0.id == selectedID }),
              let config = saved?.configuration ?? fallbackConfiguration ?? HomeWidgetStore.shared.read().configuration else { return }
        configuration = config
        activity = existing
        sessionID = UUID()
        startedAt = saved?.startedAt ?? Date()
        lastScheduledContent = existing.content.state
        HomeWidgetStore.shared.configure(config)
        HomeWidgetStore.shared.publish(existing.content.state, for: config)
        scheduleContent(HomeWidgetStore.shared.read().liveContent(for: config))
        persistence.record("activity_recovered", detail: existing.activityState == .stale ? "stale" : "active")
        persistSession()
        beginTimer()
        monitor(existing)
        beginLocationUpdates()
        refresh()
    }

    func start(_ config: RideTrackingConfiguration) throws {
        recoverExistingActivity(fallbackConfiguration: config)
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
        if sessionID != nil { configure(config); return }
        // Create synchronously while foregrounded, before GPS/network callbacks
        // or permission prompts. Live only reports active after this succeeds.
        let initial = HomeWidgetStore.shared.read().liveContent(for: config)
        let current: Activity<RideTrackingAttributes>
        do {
            current = try Activity.request(attributes: RideTrackingAttributes(stateName: config.stateName),
                content: ActivityContent(state: initial, staleDate: nil), pushType: nil)
        } catch {
            persistence.record("activity_creation_failed", detail: "\((error as NSError).domain):\((error as NSError).code)")
            throw error
        }
        errorMessage = ""
        configuration = config
        activity = current
        lastScheduledContent = initial
        sessionID = UUID()
        startedAt = Date()
        persistence.record("user_started")
        persistence.record("activity_created")
        persistSession()
        beginTimer()
        monitor(current)
        beginLocationUpdates()
        refresh()
    }

    func configure(_ config: RideTrackingConfiguration) {
        recoverExistingActivity(fallbackConfiguration: config)
        guard sessionID != nil, !stopping else { return }
        let changed = configuration != config
        if configuration?.stateCode != config.stateCode {
            request?.cancel()
            request = nil
            requestID = nil
            snapshot = nil
            lastFetch = .distantPast
        }
        configuration = config
        HomeWidgetStore.shared.configure(config)
        if changed {
            // Never carry a previous region or excluded aircraft into new settings.
            scheduleContent(HomeWidgetStore.shared.read().liveContent(for: config))
        }
        persistSession()
        refresh()
    }

    func stop(reason: LiveTrackingStopReason = .userStop) async {
        guard !stopping else { return }
        let oldActivity = prepareToStop(reason: reason)
        await dismissStoppedActivity(oldActivity, reason: reason)
        stopping = false
    }

    func stopForApplicationTermination() {
        guard !stopping else { return }
        // Save the stop and release GPS synchronously before iOS exits.
        let oldActivity = prepareToStop(reason: .appClosed)
        Task { await self.dismissStoppedActivity(oldActivity, reason: .appClosed) }
    }

    private func prepareToStop(reason: LiveTrackingStopReason) -> Activity<RideTrackingAttributes>? {
        stopping = true
        persistence.record("session_stopped", detail: reason.rawValue)
        // Persist Stop before awaiting, so relaunch cannot restart a stopped session.
        persistence.save(SavedLiveTrackingSession(enabled: false, stopReason: reason.rawValue))
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
        SharedLocationService.shared.unsubscribe("live-tracking")
        snapshot = nil
        position = nil
        configuration = nil
        lastFetch = .distantPast
        startedAt = nil
        return oldActivity
    }

    private func dismissStoppedActivity(_ oldActivity: Activity<RideTrackingAttributes>?, reason: LiveTrackingStopReason) async {
        if reason.shouldRemoveActivity {
            if let oldActivity { await oldActivity.end(nil, dismissalPolicy: .immediate) }
            for other in Activity<RideTrackingAttributes>.activities where other.id != oldActivity?.id {
                await other.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    private func beginLocationUpdates() {
        guard sessionID != nil, !stopping else { return }
        errorMessage = ""
        SharedLocationService.shared.subscribe("live-tracking", background: true,
            locations: { [weak self] fixes in
                self?.locationManager(SharedLocationService.shared.manager, didUpdateLocations: fixes)
            }, error: { [weak self] error in
                self?.locationManager(SharedLocationService.shared.manager, didFailWithError: error)
            }, authorization: { [weak self] in
                self?.locationManagerDidChangeAuthorization(SharedLocationService.shared.manager)
            })
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard sessionID != nil else { return }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: beginLocationUpdates()
        case .denied, .restricted:
            errorMessage = "Allow location access in Settings to resume Live updates. The last aircraft result is retained."
            persistence.record("location_permission_unavailable", detail: String(manager.authorizationStatus.rawValue))
            position = nil
        default: break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard sessionID != nil, let location = locations.last, location.horizontalAccuracy >= 0,
              location.horizontalAccuracy <= 100, abs(location.timestamp.timeIntervalSinceNow) <= 30 else { return }
        position = location
        refresh()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard sessionID != nil else { return }
        position = nil
        persistence.record("location_error", detail: "\((error as NSError).domain):\((error as NSError).code)")
        refresh()
    }

    private func refresh() {
        guard let config = configuration, let id = sessionID, !stopping else { return }
        publish()
        guard CLLocationManager.locationServicesEnabled(),
              locationManager.authorizationStatus == .authorizedWhenInUse || locationManager.authorizationStatus == .authorizedAlways else { return }
        guard request == nil, Date().timeIntervalSince(lastFetch) >= 15 else { return }
        lastFetch = Date()
        // Distance is calculated on-device; the request contains no rider coordinates.
        let aircraftRequest = AppBackend.aircraftRequest(stateCode: config.stateCode)
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
                let (data, response) = try await self.network.data(for: aircraftRequest)
                guard !Task.isCancelled, self.sessionID == id, self.requestID == fetchID,
                      self.configuration?.stateCode == stateCode,
                      (response as? HTTPURLResponse)?.statusCode == 200 else { return }
                let result = try JSONDecoder().decode(RideTrackingSnapshot.self, from: data)
                self.snapshot = result
                if Date().timeIntervalSince(self.lastHeartbeat) >= 60 {
                    self.persistence.record("feed_received", detail: UIApplication.shared.applicationState == .background ? "background" : "foreground")
                    self.lastHeartbeat = Date()
                }
                self.publish()
            } catch {
                // Don't advance the freshness deadline on a failed request.
                if !Task.isCancelled, self.sessionID == id { self.publish() }
            }
        }
    }

    private func publish() {
        guard let config = configuration, sessionID != nil else { return }
        var candidate = RideTrackingCalculator.summarize(snapshot: snapshot,
            lat: position?.coordinate.latitude, lon: position?.coordinate.longitude,
            locationDate: position?.timestamp, configuration: config)
        candidate.stateName = config.stateName
        let previous = lastScheduledContent ?? activity?.content.state
        guard let content = RideTrackingCalculator.displayedContent(candidate, previous: previous) else { return }
        scheduleContent(content)
    }

    private func scheduleContent(_ content: RideTrackingContent) {
        guard let config = configuration, let id = sessionID else { return }
        guard let current = activity else { return }
        // Updating every GPS callback is unnecessary; distance is shown to one decimal.
        let previousContent = lastScheduledContent ?? current.content.state
        if previousContent.aircraft == content.aircraft, previousContent.rideState == content.rideState,
           previousContent.message == content.message,
           previousContent.stateName == content.stateName,
           rounded(previousContent.distanceNm) == rounded(content.distanceNm),
           abs(previousContent.validUntil.timeIntervalSince(content.validUntil)) < 10 { return }
        HomeWidgetStore.shared.publish(content, for: config)
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
    private func beginTimer() {
        guard timer == nil else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
    }

    private func persistSession() {
        persistence.save(SavedLiveTrackingSession(enabled: sessionID != nil,
            activityID: activity?.id, configuration: configuration, startedAt: startedAt))
    }

    private func monitor(_ current: Activity<RideTrackingAttributes>) {
        activityMonitor?.cancel()
        let id = sessionID
        activityMonitor = Task { [weak self] in
            for await state in current.activityStateUpdates {
                guard !Task.isCancelled, let self, self.sessionID == id else { return }
                self.persistence.record("activity_state", detail: String(describing: state))
                if state == .ended || state == .dismissed {
                    // iOS may leave an ended activity on the Lock Screen. Do not remove it ourselves.
                    await self.stop(reason: state == .ended ? .systemEnded : .systemDismissed)
                    return
                }
            }
        }
    }
    private func failure(_ text: String) -> NSError {
        NSError(domain: "OOS", code: 1, userInfo: [NSLocalizedDescriptionKey: text])
    }
}
