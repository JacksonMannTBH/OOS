import UIKit
import WebKit
import Capacitor

@objc(OOSScreenAwakePlugin)
public class ScreenAwakePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OOSScreenAwakePlugin"
    public let jsName = "OOSScreenAwake"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "acquire", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise)
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
    var openHomeOnLoad = false

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ScreenAwakePlugin())
        bridge?.registerPluginInstance(LiveTrackingPlugin())
        bridge?.registerPluginInstance(NotificationSetupPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Capacitor performs its initial navigation in super.viewDidLoad().
        // Apply a cold-launch activity link afterward so it isn't overwritten.
        if openHomeOnLoad { openHome() }
    }

    func openHome() {
        guard isViewLoaded, let webView = bridge?.webView, let base = bridge?.config.localURL else {
            openHomeOnLoad = true
            return
        }
        openHomeOnLoad = false
        webView.load(URLRequest(url: base.appendingPathComponent("home")))
    }
}
