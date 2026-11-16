import UIKit
import WebKit
import Capacitor

@objc(OOSScreenAwakePlugin)
public class ScreenAwakePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OOSScreenAwakePlugin"
    public let jsName = "OOSScreenAwake"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "acquire", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "orientationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setOrientationLocked", returnType: CAPPluginReturnPromise)
    ]
    private var leases = Set<String>()
    private var observers: [NSObjectProtocol] = []
    private var urlObservation: NSKeyValueObservation?
    private var loadingObservation: NSKeyValueObservation?

    public override func load() {
        for name in [UIApplication.willResignActiveNotification, UIApplication.didBecomeActiveNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] note in
                if note.name == UIApplication.willResignActiveNotification {
                    UIApplication.shared.isIdleTimerDisabled = false
                } else {
                    self?.updateIdleTimer()
                }
            })
        }
        urlObservation = bridge?.webView?.observe(\.url, options: [.new]) { [weak self] _, _ in
            guard let self = self else { return }
            if !self.isRidePage { self.leases.removeAll() }
            self.updateIdleTimer()
        }
        // A full page reload can discard JavaScript before its cleanup runs.
        loadingObservation = bridge?.webView?.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
            if webView.isLoading {
                self?.leases.removeAll()
                self?.updateIdleTimer()
            }
        }
    }

    @objc func acquire(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("Missing screen wake identifier"); return }
        DispatchQueue.main.async {
            if self.isRidePage { self.leases.insert(id) }
            self.updateIdleTimer()
            call.resolve()
        }
    }

    @objc func release(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("Missing screen wake identifier"); return }
        DispatchQueue.main.async {
            self.leases.remove(id)
            self.updateIdleTimer()
            call.resolve()
        }
    }

    @objc func orientationStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController as? OOSBridgeViewController else {
                call.resolve(["supported": false, "locked": false]); return
            }
            call.resolve(controller.rideOrientationStatus())
        }
    }

    @objc func setOrientationLocked(_ call: CAPPluginCall) {
        guard let locked = call.getBool("locked"), let sessionID = call.getString("sessionId") else {
            call.reject("Missing orientation request."); return
        }
        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController as? OOSBridgeViewController,
                  controller.setRideOrientationLocked(locked, sessionID: sessionID) else {
                call.reject("Could not change screen rotation. Try again."); return
            }
            call.resolve(controller.rideOrientationStatus())
        }
    }

    private var isRidePage: Bool {
        let path = bridge?.webView?.url?.path ?? ""
        return path == "/ride" || path.hasPrefix("/ride/")
    }

    private func updateIdleTimer() {
        UIApplication.shared.isIdleTimerDisabled = !leases.isEmpty && isRidePage && UIApplication.shared.applicationState == .active
    }

    deinit {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = false }
    }
}

class OOSBridgeViewController: CAPBridgeViewController {
    var destinationOnLoad: String?
    private var rideOrientation: UIInterfaceOrientation?
    private var rideOrientationUnlocked = false
    private var rideOrientationSessionID: String?
    private var orientationURLObservation: NSKeyValueObservation?

    var compassHeadingOrientation: RideMountOrientation? { mountOrientation(currentInterfaceOrientation) }

    private func refreshCompassOrientation() {
        (bridge?.plugin(withName: "OOSLocation") as? SharedLocationPlugin)?.refreshHeadingOrientation()
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: nil) { [weak self] _ in
            self?.refreshCompassOrientation()
        }
    }

    var rideCalibrationOrientation: RideMountOrientation? {
        guard isRidePage else { return nil }
        return mountOrientation(rideOrientation ?? currentInterfaceOrientation)
    }

    private func mountOrientation(_ orientation: UIInterfaceOrientation?) -> RideMountOrientation? {
        switch orientation {
        case .portrait: return .portrait
        case .portraitUpsideDown: return .portraitUpsideDown
        case .landscapeLeft: return .landscapeLeft
        case .landscapeRight: return .landscapeRight
        default: return nil
        }
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        guard let rideOrientation else { return super.supportedInterfaceOrientations }
        return UIInterfaceOrientationMask(rawValue: 1 << rideOrientation.rawValue)
    }

    override func capacitorDidLoad() {
        #if DEBUG
        bridge?.registerPluginInstance(ProSubscriptionPlugin())
        bridge?.registerPluginInstance(RiderSharingPlugin())
        #endif
        bridge?.registerPluginInstance(SharedLocationPlugin())
        bridge?.registerPluginInstance(ScreenAwakePlugin())
        bridge?.registerPluginInstance(LiveTrackingPlugin())
        bridge?.registerPluginInstance(RideRecorderPlugin())
        bridge?.registerPluginInstance(NotificationSetupPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Observe native navigation as well as SPA history changes. The lock is
        // independent of the optional keep-screen-awake setting and recording.
        orientationURLObservation = bridge?.webView?.observe(\.url, options: [.initial, .new]) { [weak self] _, _ in
            self?.updateRideOrientationLock()
        }
        // Capacitor performs its initial navigation in super.viewDidLoad().
        // Apply a cold-launch activity link afterward so it isn't overwritten.
        if let destinationOnLoad { openDestination(destinationOnLoad) }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // Cold launches can reach /ride before the view has a window scene.
        updateRideOrientationLock()
        refreshCompassOrientation()
    }

    private func updateRideOrientationLock() {
        var followDevice = false
        if isRidePage {
            if rideOrientationSessionID == nil {
                rideOrientationSessionID = UUID().uuidString
                UIDevice.current.beginGeneratingDeviceOrientationNotifications()
            }
            // Keep the captured direction through reloads and app switching.
            if rideOrientation == nil && !rideOrientationUnlocked {
                guard let current = currentInterfaceOrientation else { return }
                rideOrientation = current
            }
        } else {
            guard rideOrientationSessionID != nil else { return }
            rideOrientation = nil
            rideOrientationUnlocked = false
            rideOrientationSessionID = nil
            followDevice = true
        }
        applyRideOrientation(followDevice: followDevice)
        if followDevice { UIDevice.current.endGeneratingDeviceOrientationNotifications() }
    }

    private var isRidePage: Bool {
        let path = bridge?.webView?.url?.path ?? ""
        return path == "/ride" || path.hasPrefix("/ride/")
    }

    private var currentInterfaceOrientation: UIInterfaceOrientation? {
        guard let scene = viewIfLoaded?.window?.windowScene else { return nil }
        let current: UIInterfaceOrientation
        if #available(iOS 26.0, *) { current = scene.effectiveGeometry.interfaceOrientation }
        else { current = scene.interfaceOrientation }
        return current == .unknown ? nil : current
    }

    func rideOrientationStatus() -> [String: Any] {
        updateRideOrientationLock()
        return ["supported": isRidePage, "locked": rideOrientation != nil,
                "sessionId": rideOrientationSessionID.map { $0 as Any } ?? NSNull()]
    }

    func setRideOrientationLocked(_ locked: Bool, sessionID: String) -> Bool {
        // A late request from an earlier Ride screen must not change a new one.
        guard isRidePage, sessionID == rideOrientationSessionID,
              UIApplication.shared.applicationState == .active else { return false }
        if locked {
            guard let current = currentInterfaceOrientation else { return false }
            rideOrientation = current
        } else {
            rideOrientation = nil
        }
        rideOrientationUnlocked = !locked
        applyRideOrientation(followDevice: !locked)
        return true
    }

    private var deviceInterfaceOrientations: UIInterfaceOrientationMask {
        let preferred: UIInterfaceOrientationMask
        switch UIDevice.current.orientation {
        case .portrait: preferred = .portrait
        case .portraitUpsideDown: preferred = .portraitUpsideDown
        // Device and interface landscape directions use opposite conventions.
        case .landscapeLeft: preferred = .landscapeRight
        case .landscapeRight: preferred = .landscapeLeft
        default: return super.supportedInterfaceOrientations
        }
        let allowed = preferred.intersection(super.supportedInterfaceOrientations)
        return allowed.isEmpty ? super.supportedInterfaceOrientations : allowed
    }

    private func applyRideOrientation(followDevice: Bool = false) {
        if #available(iOS 16.0, *) {
            setNeedsUpdateOfSupportedInterfaceOrientations()
            if (rideOrientation != nil || followDevice), UIApplication.shared.applicationState == .active {
                let requested = rideOrientation != nil ? supportedInterfaceOrientations : deviceInterfaceOrientations
                viewIfLoaded?.window?.windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: requested))
            }
        }
        else { UIViewController.attemptRotationToDeviceOrientation() }
    }

    deinit {
        if rideOrientationSessionID != nil {
            DispatchQueue.main.async { UIDevice.current.endGeneratingDeviceOrientationNotifications() }
        }
    }

    func openDestination(_ path: String) {
        guard isViewLoaded, let webView = bridge?.webView, let base = bridge?.config.localURL else {
            destinationOnLoad = path
            return
        }
        destinationOnLoad = nil
        webView.load(URLRequest(url: base.appendingPathComponent(path)))
    }

    func appWillPause() {
        bridge?.triggerDocumentJSEvent(eventName: "pause")
    }

    func appDidResume() {
        updateRideOrientationLock()
        refreshCompassOrientation()
        bridge?.triggerDocumentJSEvent(eventName: "resume")
    }
}
