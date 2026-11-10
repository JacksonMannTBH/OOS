import UIKit
import CoreLocation
import Capacitor

@objc(OOSRideRecorderPlugin)
public class RideRecorderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OOSRideRecorderPlugin"
    public let jsName = "OOSRideRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "delete", returnType: CAPPluginReturnPromise)
    ]

    @objc func status(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { call.resolve(try RideRecordingSession.shared.status()) }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func start(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try RideRecordingSession.shared.start(consent: call.getBool("consent") ?? false)
                call.resolve(try RideRecordingSession.shared.status())
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("Missing ride identifier."); return }
        Task { @MainActor in
            do { call.resolve(["ride": try RideRecordingSession.shared.finish(id: id).payload]) }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func delete(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("Missing ride identifier."); return }
        Task { @MainActor in
            do {
                try RideRecordingSession.shared.delete(id: id)
                call.resolve(try RideRecordingSession.shared.status())
            } catch { call.reject(error.localizedDescription) }
        }
    }
}

@MainActor
final class RideRecordingSession: NSObject, @preconcurrency CLLocationManagerDelegate {
    static let shared = RideRecordingSession()
    private var manager: CLLocationManager { SharedLocationService.shared.manager }
    private let store = RideHistoryStore(url: FileManager.default.urls(for: .applicationSupportDirectory,
        in: .userDomainMask).first!.appendingPathComponent("OOSRides/history.json"))
    private var core: RideRecorderCore?
    private var message = ""
    private var foregroundObserver: NSObjectProtocol?
    private var lastFixAt: Double?
    private var now: Double { Date().timeIntervalSince1970 * 1000 }

    override init() {
        super.init()
        foregroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
            object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.core?.archive.active != nil else { return }
                self.updateLocationService()
            }
        }
    }

    private func load() throws {
        guard core == nil else { return }
        var restored = RideRecorderCore(archive: try store.read())
        if restored.archive.active != nil {
            restored.recoverInterruptedRide()
            try store.write(restored.archive)
        }
        core = restored
    }

    // Commit to disk before publishing success, including End Ride and Delete.
    private func commit(_ next: RideRecorderCore) throws {
        try store.write(next.archive)
        core = next
    }

    func status() throws -> [String: Any] {
        try load()
        guard let core else { throw RideRecordingError.invalidArchive }
        var active = core.archive.active?.payload
        if let ride = core.archive.active {
            active?["durationSeconds"] = max(0, (now - ride.startedAt) / 1000)
        }
        let recentFix = lastFixAt.map { now - $0 <= 15_000 } ?? false
        return ["supported": true, "consentRequired": !core.archive.consentGiven,
                "active": active.map { $0 as Any } ?? NSNull(),
                "rides": core.archive.rides.map(\.payload), "message": message,
                "receivingLocation": core.archive.active != nil && recentFix]
    }

    func start(consent: Bool) throws {
        try load()
        guard UIApplication.shared.applicationState == .active else {
            throw failure("Open OOS to start recording a ride.")
        }
        if core?.archive.active != nil { return }
        guard CLLocationManager.locationServicesEnabled(),
              manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways else {
            throw failure("Allow location access for OOS in Settings to record a ride.")
        }
        guard manager.accuracyAuthorization == .fullAccuracy else {
            throw failure("Turn on Precise Location for OOS in Settings to record speed and distance.")
        }
        var next = core!
        try next.start(now: now, consent: consent)
        try commit(next)
        message = ""
        lastFixAt = nil
        updateLocationService()
    }

    func finish(id: String) throws -> RecordedRide {
        try load()
        var next = core!
        let ride = try next.finish(id: id, now: now)
        try commit(next)
        stopLocationService()
        message = ""
        lastFixAt = nil
        return ride
    }

    func delete(id: String) throws {
        try load()
        var next = core!
        try next.delete(id: id)
        try commit(next)
    }

    private func updateLocationService() {
        guard core?.archive.active != nil else { return }
        guard CLLocationManager.locationServicesEnabled(),
              manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways,
              manager.accuracyAuthorization == .fullAccuracy else {
            noteGap("Ride recording needs Precise Location. Allow it in Settings, or end the ride to save what was recorded.")
            stopLocationService()
            return
        }
        SharedLocationService.shared.subscribe("ride-recording", background: true,
            locations: { [weak self] fixes in
                self?.locationManager(SharedLocationService.shared.manager, didUpdateLocations: fixes)
            }, error: { [weak self] error in
                self?.locationManager(SharedLocationService.shared.manager, didFailWithError: error)
            }, authorization: { [weak self] in self?.updateLocationService() })
    }

    private func stopLocationService() {
        SharedLocationService.shared.unsubscribe("ride-recording")
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { updateLocationService() }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard var next = core, next.archive.active != nil else { return }
        let timestamp = now
        for location in locations.sorted(by: { $0.timestamp < $1.timestamp }) {
            next.accept(RideLocationSample(timestamp: location.timestamp.timeIntervalSince1970 * 1000,
                latitude: location.coordinate.latitude, longitude: location.coordinate.longitude,
                accuracy: location.horizontalAccuracy, speed: location.speed, speedAccuracy: location.speedAccuracy), now: timestamp)
        }
        do {
            try commit(next)
            if let ride = next.archive.active, ride.sampleCount > 0 {
                lastFixAt = ride.updatedAt
            }
            message = ""
        } catch {
            core?.markGap()
            message = "Ride progress could not be saved. Free up storage and try again. Keep the app open until it can save."
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard core?.archive.active != nil else { return }
        noteGap("GPS is unavailable. Recording will resume when a reliable location is available.")
    }

    private func noteGap(_ text: String) {
        guard var next = core else { return }
        next.markGap()
        do { try commit(next); message = text }
        catch { core?.markGap(); message = "Ride progress could not be saved. Free up storage and try again." }
        lastFixAt = nil
    }

    private func failure(_ text: String) -> NSError {
        NSError(domain: "OOSRideRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: text])
    }
}
