import UIKit
import Capacitor
import UserNotifications

/// APNs bridge: no browser PushManager or bundled server credentials.
@objc(ClubPushPlugin)
final class ClubPushPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ClubPushPlugin"
    let jsName = "ClubPush"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unregister", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumeTap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]
    static weak var instance: ClubPushPlugin?
    static var token: String? = UserDefaults.standard.string(forKey: "club.apns.token")
    private static var lastTapIdentifier: String?
    static var pendingTap: [String: Any]?
    private var pending: CAPPluginCall?
    private var timeout: DispatchWorkItem?

    override func load() {
        Self.instance = self
    }
    private var environment: String {
        // Xcode device builds carry their profile; App Store installations do not.
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let profile = String(data: data, encoding: .isoLatin1),
              let start = profile.range(of: "<?xml"), let end = profile.range(of: "</plist>", range: start.lowerBound..<profile.endIndex),
              let xml = profile[start.lowerBound..<end.upperBound].data(using: .isoLatin1),
              let plist = try? PropertyListSerialization.propertyList(from: xml, format: nil) as? [String: Any],
              let entitlements = plist["Entitlements"] as? [String: Any],
              let value = entitlements["aps-environment"] as? String
        else {
            #if DEBUG
            return "unknown"
            #else
            return "production"
            #endif
        }
        return value == "production" ? "production" : "sandbox"
    }
    @objc func status(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let permission = settings.authorizationStatus == .notDetermined ? "prompt" :
                ([.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) ? "granted" : "denied")
            DispatchQueue.main.async {
                call.resolve(["permission": permission, "token": Self.token ?? "", "environment": self.environment])
            }
        }
    }
    @objc func register(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("El registro de avisos ya está en curso."); return }
            guard self.environment != "unknown" else { call.reject("Falta activar Push Notifications en la firma de Xcode."); return }
            self.pending = call
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { allowed, error in
                DispatchQueue.main.async {
                    guard self.pending != nil else { return }
                    guard allowed, error == nil else { self.finish(error: "Activa las notificaciones en Ajustes del iPhone."); return }
                    let timeout = self.makeRegistrationTimeout()
                    self.timeout = timeout
                    DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: timeout)
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }
    private func makeRegistrationTimeout() -> DispatchWorkItem {
        DispatchWorkItem { [weak self] in
            self?.finish(error: "Apple no ha respondido al registro. Comprueba la conexión y vuelve a intentarlo.")
        }
    }
    static func registered(_ data: Data) {
        DispatchQueue.main.async {
            token = data.map { String(format: "%02x", $0) }.joined()
            UserDefaults.standard.set(token, forKey: "club.apns.token")
            instance?.finish(error: nil)
            instance?.notifyListeners("registration", data: ["token": token ?? ""], retainUntilConsumed: true)
        }
    }
    static func failed(_ error: Error) {
        DispatchQueue.main.async { instance?.finish(error: "No se pudo registrar el iPhone con Apple: \(error.localizedDescription)") }
    }
    private func finish(error: String?) {
        timeout?.cancel(); timeout = nil
        guard let call = pending else { return }
        pending = nil
        if let error = error { call.reject(error) }
        else { call.resolve(["token": Self.token ?? "", "environment": environment]) }
    }
    @objc func unregister(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.finish(error: "Registro cancelado.")
            UIApplication.shared.unregisterForRemoteNotifications()
            Self.token = nil
            UserDefaults.standard.removeObject(forKey: "club.apns.token")
            call.resolve()
        }
    }
    @objc func consumeTap(_ call: CAPPluginCall) {
        call.resolve(Self.pendingTap ?? [:]); Self.pendingTap = nil
    }
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            call.resolve()
        }
    }
    /// Called by the AppDelegate (installed before launch) and SceneDelegate.
    /// Retain cold-launch taps until the authenticated web app is ready.
    static func handleResponse(_ response: UNNotificationResponse) {
        DispatchQueue.main.async {
            let identifier = response.notification.request.identifier + ":" + response.actionIdentifier
            guard lastTapIdentifier != identifier else { return }
            lastTapIdentifier = identifier
            let payload: [String: Any] = ["url": response.notification.request.content.userInfo["url"] as? String ?? "./#inicio"]
            pendingTap = payload
            instance?.notifyListeners("notificationTap", data: payload, retainUntilConsumed: true)
        }
    }
}
