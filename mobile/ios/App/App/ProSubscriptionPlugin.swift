import UIKit
import StoreKit
import Capacitor

// Membership preview only. Paid billing and server enforcement are not enabled.
#if DEBUG

@objc(OOSProPlugin)
public class ProSubscriptionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OOSProPlugin"
    public let jsName = "OOSPro"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTestingPlan", returnType: CAPPluginReturnPromise)
    ]
    @objc func status(_ call: CAPPluginCall) {
        Task { @MainActor in
            await ProSubscriptionSession.shared.refresh()
            call.resolve(ProSubscriptionSession.shared.payload)
        }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { call.resolve(try await ProSubscriptionSession.shared.purchase()) }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try await AppStore.sync()
                ProSubscriptionSession.shared.useStoreEntitlements()
                await ProSubscriptionSession.shared.refresh()
                call.resolve(ProSubscriptionSession.shared.payload)
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("Please reopen the app and try again."); return
            }
            do { try await AppStore.showManageSubscriptions(in: scene); call.resolve() }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func setTestingPlan(_ call: CAPPluginCall) {
        Task { @MainActor in
            #if DEBUG
            guard let plan = call.getString("plan"), ["free", "pro", "elite", "store"].contains(plan) else {
                call.reject("Choose Free, Pro, or Elite."); return
            }
            ProSubscriptionSession.shared.setTestingPlan(plan)
            await ProSubscriptionSession.shared.refresh()
            call.resolve(ProSubscriptionSession.shared.payload)
            #else
            call.reject("Development testing is unavailable.")
            #endif
        }
    }
}

@MainActor
final class ProSubscriptionSession {
    static let shared = ProSubscriptionSession()
    static let productID = "live.outofsight.pro.monthly"
    private(set) var pro = false
    private(set) var elite = false
    private var product: Product?
    private var trialEligible = false
    private var expiration: Date?
    private var updates: Task<Void, Never>?
    private var foregroundObserver: NSObjectProtocol?
    private var expirationTask: Task<Void, Never>?
    private var purchasing = false
    private let testingKey = "oos.pro.development.plan"
    private var testingPlan: String {
        #if DEBUG
        return UserDefaults.standard.string(forKey: testingKey) ?? "free"
        #else
        return "store"
        #endif
    }
    private init() {
        // Owner-controlled device launch option; no membership controls are added to the UI.
        if let requestedPlan = ProcessInfo.processInfo.environment["OOS_DEVELOPMENT_MEMBERSHIP"],
           ["free", "pro", "elite"].contains(requestedPlan) {
            UserDefaults.standard.set(requestedPlan, forKey: testingKey)
        }
        updates = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result, transaction.productID == Self.productID {
                    await transaction.finish()
                }
                await self.refresh()
            }
        }
        foregroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
            object: nil, queue: .main) { [weak self] _ in Task { @MainActor in await self?.refresh() } }
        Task { [weak self] in self?.product = try? await Product.products(for: [Self.productID]).first }
    }
    func useStoreEntitlements() {
        #if DEBUG
        UserDefaults.standard.set("store", forKey: testingKey)
        #endif
    }
    #if DEBUG
    func setTestingPlan(_ plan: String) { UserDefaults.standard.set(plan, forKey: testingKey) }
    #endif

    func refresh() async {
        var entitled = false
        var expiry: Date?
        // currentEntitlements includes subscriptions in Apple's billing grace
        // period and excludes revoked/refunded purchases. Never trust JS flags.
        for await result in StoreKit.Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  transaction.productID == Self.productID,
                  transaction.revocationDate == nil, !transaction.isUpgraded else { continue }
            entitled = true
            expiry = transaction.expirationDate
        }
        #if DEBUG
        if testingPlan != "store" { entitled = testingPlan == "pro" || testingPlan == "elite"; expiry = nil }
        #endif
        // Only advertise the configured one-week free trial to eligible accounts.
        trialEligible = false
        if let subscription = product?.subscription,
           let offer = subscription.introductoryOffer,
           offer.paymentMode == .freeTrial,
           offer.periodCount == 1,
           ((offer.period.unit == .week && offer.period.value == 1) ||
            (offer.period.unit == .day && offer.period.value == 7)) {
            trialEligible = await subscription.isEligibleForIntroOffer
        }
        elite = testingPlan == "elite"
        pro = entitled
        expiration = expiry
        expirationTask?.cancel()
        if let expiry, expiry > Date() {
            let delay = min(expiry.timeIntervalSinceNow + 1, 86400)
            expirationTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(max(1, delay) * 1_000_000_000))
                guard !Task.isCancelled else { return }
                await self?.refresh()
            }
        }
        if !pro, #available(iOS 16.2, *) {
            await LiveTrackingSession.shared.stop()
        }
        // An existing ride can always be finished. New rides require access.
    }

    var payload: [String: Any] {
        var value: [String: Any] = ["ready": true, "pro": pro, "elite": elite, "development": false,
            "testingPlan": testingPlan, "productAvailable": product != nil && testingPlan == "store",
            "trialEligible": trialEligible,
            "displayPrice": product?.displayPrice as Any? ?? NSNull(),
            "expiresAt": expiration.map { $0.timeIntervalSince1970 * 1000 } as Any? ?? NSNull()]
        #if DEBUG
        value["development"] = true
        #endif
        return value
    }

    func purchase() async throws -> [String: Any] {
        guard !purchasing else { throw failure("A purchase is already in progress.") }
        // Never allow the preview controls to accidentally initiate billing.
        guard testingPlan == "store" else { throw failure("Choose StoreKit testing to test an Apple purchase.") }
        purchasing = true
        defer { purchasing = false }
        let products = try await Product.products(for: [Self.productID])
        guard let product = products.first, product.type == .autoRenewable else {
            throw failure("Subscriptions are not configured for this build yet.")
        }
        self.product = product
        switch try await product.purchase() {
        case .success(let result):
            guard case .verified(let transaction) = result, transaction.productID == Self.productID else {
                throw failure("The purchase could not be verified. Please restore purchases or try again.")
            }
            await transaction.finish()
            await refresh()
            return payload
        case .pending:
            var result = payload; result["outcome"] = "pending"; return result
        case .userCancelled:
            var result = payload; result["outcome"] = "cancelled"; return result
        @unknown default: throw failure("The purchase could not be completed.")
        }
    }
    private func failure(_ message: String) -> NSError {
        NSError(domain: "OOS.Pro", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}

#endif
