import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@main
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Allow local UI development before Firebase configuration is supplied.
        // Do not create a messaging identifier until the user opts into alerts.
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist", inDirectory: "Configuration"),
           let options = FirebaseOptions(contentsOfFile: path) {
            FirebaseApp.configure(options: options)
            Messaging.messaging().isAutoInitEnabled = false
            Messaging.messaging().delegate = self
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard FirebaseApp.app() != nil else {
            reportPushError(NSError(domain: "OutOfSight.Push", code: 1, userInfo: [NSLocalizedDescriptionKey: "not_configured"]))
            return
        }
        // Swizzling is disabled. Map Apple's token, then pass only the FCM
        // token to the web app: the existing backend expects FCM, not APNs.
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { [weak self] token, error in
            if let error = error {
                self?.reportPushError(error)
            } else if let token = token {
                self?.reportPushToken(token)
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        reportPushError(error)
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        if let token = fcmToken { reportPushToken(token) }
    }

    private func reportPushToken(_ token: String) {
        DispatchQueue.main.async {
            guard UIApplication.shared.isRegisteredForRemoteNotifications else { return }
            NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
        }
    }

    private func reportPushError(_ error: Error) {
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
        }
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
