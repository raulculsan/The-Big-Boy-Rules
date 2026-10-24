import Foundation
import Capacitor
import WidgetKit
import ActivityKit

@objc(ClubPlanWidgetPlugin)
final class ClubPlanWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ClubPlanWidgetPlugin"
    let jsName = "ClubPlanWidget"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consume", returnType: CAPPluginReturnPromise)
    ]
    private static weak var instance: ClubPlanWidgetPlugin?
    private static var pendingID: String?
    private let defaults = UserDefaults(suiteName: "group.com.raulculsan.thebigboyrules")
    override func load() { Self.instance = self }

    static func handle(_ url: URL) -> Bool {
        guard url.scheme == "bigboyrules", url.host == "plan" else { return false }
        let id = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "id" }?.value ?? ""
        guard id.count <= 64 else { return false }
        DispatchQueue.main.async {
            pendingID = id
            instance?.notifyListeners("open", data: ["id": id], retainUntilConsumed: true)
        }
        return true
    }

    @objc func consume(_ call: CAPPluginCall) {
        let id = Self.pendingID
        Self.pendingID = nil
        call.resolve(["opened": id != nil, "id": id ?? ""])
    }

    @objc func sync(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), id.count <= 64,
              let title = call.getString("title"), !title.isEmpty,
              let startMS = call.getDouble("startAt"), let endMS = call.getDouble("endAt"),
              startMS.isFinite, endMS.isFinite, (endMS > startMS || (id.isEmpty && startMS == 0 && endMS == 0)) else {
            call.reject("Plan no válido"); return
        }
        let packCount = max(0, min(999999, call.getInt("packCount") ?? 0))
        defaults?.set(packCount, forKey: "availablePacks")
        let start = Date(timeIntervalSince1970: startMS / 1000)
        let end = Date(timeIntervalSince1970: endMS / 1000)
        let safeTitle = String(title.prefix(100))
        let place = String((call.getString("location") ?? "").prefix(120))
        if id.isEmpty { defaults?.removeObject(forKey: "nextPlan") }
        else { defaults?.set(["id": id, "title": safeTitle, "location": place, "startAt": startMS / 1000, "endAt": endMS / 1000], forKey: "nextPlan") }
        WidgetCenter.shared.reloadTimelines(ofKind: "ClubNextPlan")
        if #available(iOS 16.2, *) {
            Task { @MainActor in
                let now = Date()
                for activity in Activity<ClubPlanAttributes>.activities {
                    if activity.attributes.eventID != id || now < start || now >= end {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }
                if now >= start && now < end && ActivityAuthorizationInfo().areActivitiesEnabled {
                    let state = ClubPlanAttributes.ContentState(title: safeTitle, start: start, end: end, location: place)
                    let content = ActivityContent(state: state, staleDate: end)
                    if let activity = Activity<ClubPlanAttributes>.activities.first(where: { $0.attributes.eventID == id }) {
                        await activity.update(content)
                    } else {
                        _ = try? Activity.request(attributes: ClubPlanAttributes(eventID: id), content: content, pushType: nil)
                    }
                }
            }
        }
        call.resolve(["available": true])
    }

    @objc func clear(_ call: CAPPluginCall) {
        defaults?.removeObject(forKey: "nextPlan")
        defaults?.removeObject(forKey: "availablePacks")
        WidgetCenter.shared.reloadTimelines(ofKind: "ClubNextPlan")
        if #available(iOS 16.2, *) {
            Task { for activity in Activity<ClubPlanAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) } }
        }
        call.resolve()
    }
}
