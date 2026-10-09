import Capacitor
import FirebaseCore

@objc(OOSNotificationSetupPlugin)
public class NotificationSetupPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OOSNotificationSetupPlugin"
    public let jsName = "OOSNotificationSetup"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]

    @objc func status(_ call: CAPPluginCall) {
        // This is a readiness check only: it neither asks for permission nor registers for push.
        let options = FirebaseApp.app()?.options
        call.resolve(["configured": options != nil && options?.bundleID == Bundle.main.bundleIdentifier])
    }
}
