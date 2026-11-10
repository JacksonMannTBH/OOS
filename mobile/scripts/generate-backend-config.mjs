import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = JSON.parse(fs.readFileSync(path.join(mobile, "backend.json"), "utf8"));
if (!backend.url.startsWith("https://") || !backend.publishableKey.startsWith("sb_publishable_")) throw new Error("Use an HTTPS Supabase endpoint and a public client key.");
const swift = `// Generated from mobile/backend.json. Contains only public client configuration.
import Foundation

enum AppBackend {
    static let baseURL = ${JSON.stringify(backend.url)}
    static let publishableKey = ${JSON.stringify(backend.publishableKey)}

    static func aircraftRequest(stateCode: String, now: Date = Date()) -> URLRequest {
        var url = URLComponents(string: baseURL + "/aircraft")!
        url.queryItems = [URLQueryItem(name: "state", value: stateCode),
                          URLQueryItem(name: "_", value: String(Int(now.timeIntervalSince1970 * 1000)))]
        var request = URLRequest(url: url.url!, cachePolicy: .reloadIgnoringLocalCacheData)
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        return request
    }
}
`;
const target = path.join(mobile, "ios/App/Shared/AppBackend.swift");
if (process.argv.includes("--check")) {
    if (fs.readFileSync(target, "utf8") !== swift) throw new Error("Run node scripts/generate-backend-config.mjs before building iOS.");
} else fs.writeFileSync(target, swift);
