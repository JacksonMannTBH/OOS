// Generated from mobile/backend.json. Contains only public client configuration.
import Foundation

enum AppBackend {
    static let baseURL = "https://ohhixakjamjocgmatbha.supabase.co/functions/v1/oos-app"
    static let publishableKey = "sb_publishable_tZwug4F9kgYLCNZ_iz5nPg_53QteU-M"

    static func aircraftRequest(stateCode: String, now: Date = Date()) -> URLRequest {
        var url = URLComponents(string: baseURL + "/aircraft")!
        url.queryItems = [URLQueryItem(name: "state", value: stateCode),
                          URLQueryItem(name: "_", value: String(Int(now.timeIntervalSince1970 * 1000)))]
        var request = URLRequest(url: url.url!, cachePolicy: .reloadIgnoringLocalCacheData)
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        return request
    }
}
