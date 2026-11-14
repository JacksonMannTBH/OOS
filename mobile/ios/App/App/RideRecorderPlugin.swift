import UIKit
import CoreLocation
import CoreMotion
import Capacitor

@objc(OOSRideRecorderPlugin)
public class RideRecorderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OOSRideRecorderPlugin"
    public let jsName = "OOSRideRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "gForceStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configureMotion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "calibrateMotion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetMotionPeaks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetGForcePeaks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "delete", returnType: CAPPluginReturnPromise)
    ]

    @objc func status(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { call.resolve(try RideRecordingSession.shared.status()) }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func gForceStatus(_ call: CAPPluginCall) {
        Task { @MainActor in
            call.resolve(RideRecordingSession.shared.gForceStatus())
        }
    }
    @objc func start(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try RideRecordingSession.shared.start(consent: call.getBool("consent") ?? false,
                    recordAngles: call.getBool("recordAngles") ?? false)
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
    @objc func configureMotion(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try RideRecordingSession.shared.configureMotion(enabled: call.getBool("enabled") ?? false)
                call.resolve(RideRecordingSession.shared.motionStatus())
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func resetMotionPeaks(_ call: CAPPluginCall) {
        guard let rideId = call.getString("rideId") else { call.reject("Missing ride identifier."); return }
        Task { @MainActor in
            do {
                try RideRecordingSession.shared.resetMotionPeaks(rideId: rideId)
                call.resolve(try RideRecordingSession.shared.status())
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func resetGForcePeaks(_ call: CAPPluginCall) {
        guard let rideId = call.getString("rideId") else { call.reject("Missing ride identifier."); return }
        Task { @MainActor in
            do {
                try RideRecordingSession.shared.resetGForcePeaks(rideId: rideId)
                call.resolve(try RideRecordingSession.shared.status())
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func calibrateMotion(_ call: CAPPluginCall) {
        guard let rideId = call.getString("rideId") else { call.reject("Missing ride identifier."); return }
        Task { @MainActor in
            do {
                try RideRecordingSession.shared.calibrateMotion(rideId: rideId)
                call.resolve(RideRecordingSession.shared.motionStatus())
            } catch RideCalibrationError.notReady {
                call.reject("Waiting for the bike to stabilize.", "CALIBRATION_NOT_READY")
            } catch { call.reject(error.localizedDescription) }
        }
    }
}

private enum RideCalibrationError: Error {
    case notReady
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
    private var backgroundObserver: NSObjectProtocol?
    private var lastFixAt: Double?
    private let motionManager = CMMotionManager()
    private var motionTracker = RideMotionTracker()
    private var motionEnabled = false
    private var anglesCalibrated = false
    private var liveGForce: RideGForceReading?
    private var motionMessage = ""
    private var motionReadError: String?
    private var stableMotionSamples = 0
    private var lastMotionTimestamp: Double?
    private var lastMotionSaveAt = 0.0
    private var lastSpeed: Double?
    private var now: Double { Date().timeIntervalSince1970 * 1000 }

    override init() {
        super.init()
        foregroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
            object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.core?.archive.active != nil else { return }
                self.updateLocationService()
                self.updateMotionService()
            }
        }
        backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,
            object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.pauseMotion()
                if let core = self.core, core.archive.active != nil {
                    do { try self.commit(core) }
                    catch { self.motionMessage = "Motion progress could not be saved. Please free up storage." }
                }
            }
        }
    }

    private func load() throws {
        guard core == nil else { return }
        let archive = try store.read()
        var restored = RideRecorderCore(archive: archive)
        if restored.archive.active != nil {
            restored.recoverInterruptedRide()
        }
        if restored.archive != archive {
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
                "lifetimeStats": (core.archive.lifetimeStats ?? RideLifetimeStats()).payload,
                "receivingLocation": core.archive.active != nil && recentFix, "motion": motionStatus()]
    }

    func start(consent: Bool, recordAngles: Bool = false) throws {
        try load()
        guard UIApplication.shared.applicationState == .active else {
            throw failure("Open OOS to start recording a ride.")
        }
        if core?.archive.active != nil { try configureMotion(enabled: recordAngles); return }
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
        lastSpeed = nil
        motionTracker = RideMotionTracker()
        anglesCalibrated = false
        liveGForce = nil
        try configureMotion(enabled: recordAngles)
        updateLocationService()
    }

    func finish(id: String) throws -> RecordedRide {
        try load()
        var next = core!
        let ride = try next.finish(id: id, now: now)
        try commit(next)
        motionEnabled = false
        pauseMotion()
        motionTracker = RideMotionTracker()
        anglesCalibrated = false
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

    func motionStatus() -> [String: Any] {
        ["supported": motionManager.isDeviceMotionAvailable, "enabled": motionEnabled,
         "calibrated": motionTracker.calibrated && anglesCalibrated,
         "gForceCalibrated": motionTracker.calibrated, "message": motionMessage]
    }

    func gForceStatus() -> [String: Any] {
        let fresh = liveGForce.flatMap { reading -> RideGForceReading? in
            guard motionManager.isDeviceMotionActive,
                  UIApplication.shared.applicationState == .active,
                  ProcessInfo.processInfo.systemUptime - reading.timestamp < 0.3 else { return nil }
            return reading
        }
        return ["supported": motionManager.isDeviceMotionAvailable,
                "calibrated": motionTracker.calibrated, "receiving": fresh != nil,
                "reading": fresh.map { $0.payload as Any } ?? NSNull(),
                "peaks": core?.archive.active?.gForce.map { $0.payload as Any } ?? NSNull(),
                "message": motionMessage]
    }

    func configureMotion(enabled: Bool) throws {
        try load()
        if !enabled {
            // Turning off angles leaves the shared G-force stream and mount
            // calibration running. Already recorded angle peaks are retained.
            if let core, core.archive.active != nil { try commit(core) }
            anglesCalibrated = false
            motionTracker.resetSamples()
        }
        motionEnabled = enabled
        updateMotionService()
    }

    func calibrateMotion(rideId: String) throws {
        guard core?.archive.active != nil else { throw failure("Start a ride before calibrating.") }
        guard core?.archive.active?.id == rideId else { throw RideRecordingError.wrongRide }
        guard motionManager.isDeviceMotionAvailable else { throw failure("Motion sensors are unavailable on this device.") }
        guard UIApplication.shared.applicationState == .active else { throw failure("Open Ride mode to calibrate.") }
        if let motionReadError { throw failure(motionReadError) }
        guard let motion = motionManager.deviceMotion,
              ProcessInfo.processInfo.systemUptime - motion.timestamp < 0.3,
              stableMotionSamples >= 15, (lastSpeed ?? 0) < 0.8 else {
            throw RideCalibrationError.notReady
        }
        var tracker = motionTracker
        guard tracker.calibrate(gravity: RideMotionVector(x: motion.gravity.x, y: motion.gravity.y, z: motion.gravity.z)) else {
            throw RideCalibrationError.notReady
        }
        var next = core!
        try next.calibrateMotion(now: now, recordAngles: motionEnabled)
        try commit(next)
        motionTracker = tracker
        anglesCalibrated = motionEnabled
        liveGForce = nil
        motionMessage = ""
        lastMotionSaveAt = now
    }

    func resetMotionPeaks(rideId: String) throws {
        try load()
        var next = core!
        try next.resetMotionPeaks(id: rideId)
        try commit(next)
        // Discard pre-reset candidates without changing the calibration or pitch branch.
        motionTracker.resetSamples(preservingOrientation: true)
        lastMotionSaveAt = now
    }

    func resetGForcePeaks(rideId: String) throws {
        try load()
        var next = core!
        try next.resetGForcePeaks(id: rideId)
        try commit(next)
        // Keep the mount calibration, angle tracking and live dot uninterrupted.
        lastMotionSaveAt = now
    }

    private func updateMotionService() {
        guard core?.archive.active != nil, UIApplication.shared.applicationState == .active else { return }
        guard motionManager.isDeviceMotionAvailable else {
            motionMessage = "Motion sensors are unavailable on this device."
            return
        }
        guard !motionManager.isDeviceMotionActive else { return }
        motionReadError = nil
        motionManager.deviceMotionUpdateInterval = 1.0 / 25.0
        motionManager.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: .main) { [weak self] motion, error in
            MainActor.assumeIsolated {
                guard let self, self.motionManager.isDeviceMotionActive,
                      UIApplication.shared.applicationState == .active, self.core?.archive.active != nil else { return }
                guard let motion, error == nil else {
                    self.motionMessage = "Motion readings are unavailable. Check Motion & Fitness access for OOS in Settings."
                    self.motionReadError = self.motionMessage
                    self.stableMotionSamples = 0
                    self.liveGForce = nil
                    self.core?.resetGForceCandidates()
                    self.motionTracker.resetSamples()
                    return
                }
                self.motionReadError = nil
                let continuous = self.lastMotionTimestamp.map { motion.timestamp > $0 && motion.timestamp - $0 < 0.2 } ?? false
                let rotation = RideMotionVector(x: motion.rotationRate.x, y: motion.rotationRate.y, z: motion.rotationRate.z)
                let acceleration = RideMotionVector(x: motion.userAcceleration.x, y: motion.userAcceleration.y, z: motion.userAcceleration.z)
                self.stableMotionSamples = rotation.length < 0.1 && acceleration.length < 0.06
                    ? (continuous ? self.stableMotionSamples + 1 : 1) : 0
                self.lastMotionTimestamp = motion.timestamp
                self.liveGForce = self.motionTracker.gForce(acceleration: acceleration,
                    gravity: RideMotionVector(x: motion.gravity.x, y: motion.gravity.y, z: motion.gravity.z),
                    timestamp: motion.timestamp)
                if let reading = self.liveGForce { self.core?.acceptGForce(reading) }
                else { self.core?.resetGForceCandidates() }
                if self.motionEnabled && self.anglesCalibrated,
                   let angles = self.motionTracker.accept(gravity: RideMotionVector(x: motion.gravity.x,
                    y: motion.gravity.y, z: motion.gravity.z), timestamp: motion.timestamp, rotationRate: rotation) {
                    self.core?.acceptMotion(angles)
                }
                if self.now - self.lastMotionSaveAt >= 2000, let core = self.core {
                    do { try self.commit(core); self.lastMotionSaveAt = self.now; self.motionMessage = "" }
                    catch { self.motionMessage = "Motion progress could not be saved. Please free up storage." }
                }
            }
        }
    }

    private func pauseMotion() {
        motionManager.stopDeviceMotionUpdates()
        liveGForce = nil
        core?.resetGForceCandidates()
        stableMotionSamples = 0
        lastMotionTimestamp = nil
        motionTracker.resetSamples()
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
            lastSpeed = locations.last.flatMap { $0.speed >= 0 && $0.speedAccuracy >= 0 && $0.speedAccuracy <= 3 ? $0.speed : nil }
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
