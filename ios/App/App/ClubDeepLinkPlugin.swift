import Foundation
import Capacitor

/// Keeps an account verification link through a cold WebView launch.
@objc(ClubDeepLinkPlugin)
final class ClubDeepLinkPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ClubDeepLinkPlugin"
    let jsName = "ClubDeepLink"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "consume", returnType: CAPPluginReturnPromise)]
    private static weak var instance: ClubDeepLinkPlugin?
    private static var pendingURL: String?

    override func load() { Self.instance = self }

    static func handle(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "bigboyrules",
              url.host?.lowercased() == "account-request",
              url.path == "/verify",
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let id = parts.queryItems?.first(where: { $0.name == "id" })?.value,
              let token = parts.queryItems?.first(where: { $0.name == "token" })?.value,
              id.range(of: "^[0-9a-f-]{36}$", options: .regularExpression) != nil,
              token.range(of: "^[0-9a-f-]{72}$", options: .regularExpression) != nil
        else { return false }
        DispatchQueue.main.async {
            pendingURL = url.absoluteString
            instance?.notifyListeners("open", data: ["url": url.absoluteString], retainUntilConsumed: true)
        }
        return true
    }

    @objc func consume(_ call: CAPPluginCall) {
        call.resolve(["url": Self.pendingURL ?? ""])
        Self.pendingURL = nil
    }
}
