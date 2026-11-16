import Foundation
import CoreLocation
import Security
import Capacitor

#if DEBUG

// An unbacked installation marker prevents a surviving Keychain entry from
// linking a reinstall to the old profile. Credentials never enter the web view.
enum RiderInstallation {
    static let service = "live.outofsight.rider-installation"
    static func token() throws -> String {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        var marker = directory.appendingPathComponent("rider-installation-v1")
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "capability"]
        if FileManager.default.fileExists(atPath: marker.path) {
            var result: CFTypeRef?
            let status = SecItemCopyMatching(query.merging([kSecReturnData as String: true]) { _, new in new } as CFDictionary, &result)
            if status == errSecSuccess, let data = result as? Data, let token = String(data: data, encoding: .utf8), token.count == 64 { return token }
            if status != errSecItemNotFound { throw failure("Your rider profile is temporarily unavailable.") }
        } else { SecItemDelete(query as CFDictionary) }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw failure("Your rider profile could not be created.") }
        let token = bytes.map { String(format: "%02x", $0) }.joined()
        let item = query.merging([kSecValueData as String: Data(token.utf8), kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly, kSecAttrSynchronizable as String: false]) { _, new in new }
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw failure("Your rider profile could not be saved.") }
        try Data([1]).write(to: marker, options: .atomic)
        var values = URLResourceValues(); values.isExcludedFromBackup = true; try marker.setResourceValues(values)
        return token
    }
    static func failure(_ text: String) -> NSError { NSError(domain: "OOSRiderSharing", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
}

@objc(OOSRiderSharingPlugin)
public class RiderSharingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OOSRiderSharingPlugin"
    public let jsName = "OOSRiderSharing"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMembership", returnType: CAPPluginReturnPromise)
    ]
    @objc func request(_ call: CAPPluginCall) {
        guard let method = call.getString("method"), ["POST", "GET", "PATCH"].contains(method), call.getString("path") == "profile" else { call.reject("invalid_request"); return }
        let body = call.getObject("body") ?? [:]
        Task { @MainActor in
            do {
                if method == "PATCH" { RiderSharingSession.shared.preparePrivacyChange(body) }
                let result = try await RiderSharingSession.shared.request(method: method, path: "profile", body: body)
                if method == "PATCH" { RiderSharingSession.shared.confirmPrivacyChange(body) }
                if let profile = result["profile"] as? [String: Any] { RiderSharingSession.shared.apply(profile: profile) }
                call.resolve(result)
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func setMembership(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        Task { @MainActor in RiderSharingSession.shared.setMembership(enabled); call.resolve() }
    }
}

@MainActor
final class RiderSharingSession {
    static let shared = RiderSharingSession()
    private var profile: [String: Any]?
    private var membership = false
    private var rideID: String?
    private var session: String?
    private var started = false
    private var starting = false
    private var sequence = 0
    private var latestFix: CLLocation?
    private var uploading = false
    private var lastUpload = Date.distantPast
    private var lastStartAttempt = Date.distantPast
    private var lastProfileRefresh = Date.distantPast
    private var refreshingProfile = false
    private var visibilityHeld = UserDefaults.standard.bool(forKey: "oos.rider.visibilityHold")
    private var speedHeld = UserDefaults.standard.bool(forKey: "oos.rider.speedHold")
    private var tail: Task<Void, Never>?

    // Serialize native writes so settings, pending starts, heartbeats and End
    // Ride cannot overtake one another when the connection is slow.
    func request(method: String, path: String, body: [String: Any] = [:]) async throws -> [String: Any] {
        let previous = tail
        let data = method == "GET" ? nil : try JSONSerialization.data(withJSONObject: body)
        let token = try RiderInstallation.token()
        let task = Task { @MainActor () throws -> [String: Any] in
            await previous?.value
            let base = URL(string: AppBackend.baseURL)!.deletingLastPathComponent().appendingPathComponent("oos-riders")
            var request = URLRequest(url: base.appendingPathComponent(path), cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
            request.httpMethod = method; request.httpBody = data
            request.setValue(AppBackend.publishableKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let (responseData, response) = try await URLSession.shared.data(for: request)
            let object = try JSONSerialization.jsonObject(with: responseData) as? [String: Any] ?? [:]
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw RiderInstallation.failure(object["error"] as? String ?? "sharing_unavailable")
            }
            return object
        }
        tail = Task { _ = try? await task.value }
        return try await task.value
    }

    func apply(profile: [String: Any]) {
        self.profile = profile
        if !canShare { stopSharing() } else { ensureStarted() }
    }
    // Local privacy choices take effect before the network request. Failed
    // saves cannot resume sharing on reconnect or after an app restart.
    func preparePrivacyChange(_ changes: [String: Any]) {
        if changes["visible"] as? Bool == false {
            visibilityHeld = true; UserDefaults.standard.set(true, forKey: "oos.rider.visibilityHold"); stopSharing()
        }
        if changes["shareSpeed"] as? Bool == false {
            speedHeld = true; UserDefaults.standard.set(true, forKey: "oos.rider.speedHold")
        }
    }
    func confirmPrivacyChange(_ changes: [String: Any]) {
        if changes["visible"] as? Bool == true { visibilityHeld = false; UserDefaults.standard.set(false, forKey: "oos.rider.visibilityHold") }
        if changes["shareSpeed"] as? Bool == true { speedHeld = false; UserDefaults.standard.set(false, forKey: "oos.rider.speedHold") }
    }
    func setMembership(_ enabled: Bool) {
        membership = enabled
        if !enabled { stopSharing() } else if rideID != nil { refreshProfile(force: true) }
    }
    private var canShare: Bool {
        membership && !visibilityHeld && profile?["elite"] as? Bool == true && profile?["visible"] as? Bool == true &&
        !(profile?["username"] as? String ?? "").isEmpty &&
        (profile?["eliteUntil"] as? Double ?? 0) > Date().timeIntervalSince1970 * 1000
    }
    func beginRide(_ id: String) {
        if rideID != id { stopSharing() }
        rideID = id
        if membership { refreshProfile(force: true) }
    }
    private func refreshProfile(force: Bool = false) {
        guard !refreshingProfile, force || Date().timeIntervalSince(lastProfileRefresh) >= 60 else { return }
        refreshingProfile = true; lastProfileRefresh = Date()
        Task { @MainActor in
            defer { refreshingProfile = false }
            guard let result = try? await request(method: "POST", path: "profile"), let profile = result["profile"] as? [String: Any] else { return }
            apply(profile: profile)
        }
    }
    func endRide() { rideID = nil; stopSharing() }
    func stopSharing() {
        let old = session
        session = nil; started = false; latestFix = nil
        if let old { Task { _ = try? await request(method: "DELETE", path: "presence", body: ["session": old]) } }
    }
    private func ensureStarted() {
        guard canShare, rideID != nil, session == nil, !starting, Date().timeIntervalSince(lastStartAttempt) >= 10 else { return }
        lastStartAttempt = Date()
        let id = UUID().uuidString.lowercased()
        session = id; sequence = 0; starting = true
        Task { @MainActor in
            defer { starting = false }
            do {
                _ = try await request(method: "POST", path: "presence/start", body: ["session": id])
                guard session == id, canShare, rideID != nil else {
                    _ = try? await request(method: "DELETE", path: "presence", body: ["session": id]); return
                }
                started = true
                uploadLatest()
            } catch {
                if session == id { session = nil }
                if error.localizedDescription == "elite_required" { profile?["elite"] = false }
                if error.localizedDescription == "sharing_disabled" { profile?["visible"] = false }
            }
        }
    }
    func capture(_ location: CLLocation) {
        guard membership, rideID != nil else { return }
        if !canShare {
            // A ride started offline can recover without restarting the app.
            // Recheck missing/expired access at most once a minute.
            if profile == nil || profile?["elite"] as? Bool != true ||
                (profile?["eliteUntil"] as? Double ?? 0) <= Date().timeIntervalSince1970 * 1000 { refreshProfile() }
            return
        }
        guard location.horizontalAccuracy >= 0, location.horizontalAccuracy <= 100,
              abs(location.timestamp.timeIntervalSinceNow) <= 12 else { return }
        latestFix = location
        if session == nil { ensureStarted() }
        uploadLatest()
    }
    private func uploadLatest() {
        guard canShare, started, !uploading, let id = session, let fix = latestFix,
              fix.timestamp.timeIntervalSinceNow >= -12, Date().timeIntervalSince(lastUpload) >= 5 else { return }
        sequence += 1; uploading = true; lastUpload = Date()
        var body: [String: Any] = ["session": id, "sequence": sequence, "lat": fix.coordinate.latitude,
            "lon": fix.coordinate.longitude, "accuracy": fix.horizontalAccuracy, "capturedAt": fix.timestamp.timeIntervalSince1970 * 1000]
        if !speedHeld, profile?["shareSpeed"] as? Bool == true, fix.speed >= 0, fix.speed <= 150, fix.speedAccuracy >= 0, fix.speedAccuracy <= 3 { body["speedMps"] = fix.speed }
        if fix.course >= 0, fix.course < 360 { body["heading"] = fix.course }
        Task { @MainActor in
            defer { uploading = false }
            do { _ = try await request(method: "POST", path: "presence", body: body) }
            catch {
                if error.localizedDescription == "elite_required" { profile?["elite"] = false }
                if error.localizedDescription == "sharing_disabled" { profile?["visible"] = false }
                if ["elite_required", "sharing_disabled", "session_ended"].contains(error.localizedDescription) { stopSharing() }
            }
        }
    }
}

#endif
