import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let controller = OOSBridgeViewController()
        controller.destinationOnLoad = connectionOptions.urlContexts.compactMap { destination(for: $0.url) }.first
        window?.rootViewController = controller
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
        if let path = URLContexts.compactMap({ destination(for: $0.url) }).first {
            (window?.rootViewController as? OOSBridgeViewController)?.openDestination(path)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Send this directly from the native scene. WebKit can delay its
        // visibility event while iOS is closing, locking, or switching apps.
        // Foreground-only location subscribers clear their Core Location
        // watches on this event; background features retain the shared GPS service.
        (window?.rootViewController as? OOSBridgeViewController)?.appWillPause()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        (window?.rootViewController as? OOSBridgeViewController)?.appDidResume()
    }

    private func destination(for url: URL) -> String? {
        guard url.scheme == "oos" else { return nil }
        switch url.host {
        case "home": return "home"
        case "ride": return "ride"
        default: return nil
        }
    }
}
