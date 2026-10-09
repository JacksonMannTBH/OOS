import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let controller = OOSBridgeViewController()
        controller.openRideOnLoad = connectionOptions.urlContexts.contains { isRideURL($0.url) }
        window?.rootViewController = controller
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
        if URLContexts.contains(where: { isRideURL($0.url) }) {
            (window?.rootViewController as? OOSBridgeViewController)?.openRide()
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    private func isRideURL(_ url: URL) -> Bool {
        url.scheme == "oos" && url.host == "ride"
    }
}
