import WidgetKit
import SwiftUI
import ActivityKit

private let accent = Color(red: 0.98, green: 0.66, blue: 0.26)
struct PlanEntry: TimelineEntry {
    let date: Date
    var id = ""
    var title = "La sede te espera"
    var start: Date?
    var end: Date?
    var active: Bool { if let start, let end { return date >= start && date < end }; return false }
    var link: URL { var parts = URLComponents(string: "bigboyrules://plan")!; parts.queryItems = [URLQueryItem(name: "id", value: id)]; return parts.url! }
}
struct PlanProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlanEntry { PlanEntry(date: Date(), title: "Próximo plan", start: Date().addingTimeInterval(86400)) }
    func getSnapshot(in context: Context, completion: @escaping (PlanEntry) -> Void) { completion(read()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PlanEntry>) -> Void) {
        let entry = read()
        var entries = [entry]
        if let start = entry.start, start > entry.date {
            var live = entry; live = PlanEntry(date: start, id: live.id, title: live.title, start: live.start, end: live.end); entries.append(live)
        }
        if let end = entry.end, end > entry.date { entries.append(PlanEntry(date: end)) }
        completion(Timeline(entries: entries, policy: .after(Date().addingTimeInterval(1800))))
    }
    private func read() -> PlanEntry {
        let now = Date()
        guard let plan = UserDefaults(suiteName: "group.com.raulculsan.thebigboyrules")?.dictionary(forKey: "nextPlan"),
              let title = plan["title"] as? String, let start = plan["startAt"] as? Double,
              let end = plan["endAt"] as? Double, end > now.timeIntervalSince1970 else { return PlanEntry(date: now) }
        return PlanEntry(date: now, id: plan["id"] as? String ?? "", title: title, start: Date(timeIntervalSince1970: start), end: Date(timeIntervalSince1970: end))
    }
}
struct PlanWidgetView: View {
    let entry: PlanEntry
    @Environment(\.widgetFamily) private var family
    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            VStack(alignment: .leading, spacing: 7) {
                Text(entry.active ? "AHORA · EL CLUB" : "EL CHOTA · PRÓXIMO PLAN")
                    .font(.system(size: 9, weight: .heavy, design: .rounded)).tracking(1).foregroundStyle(accent)
                Text(entry.title).font(.system(size: family == .systemSmall ? 17 : 21, weight: .bold, design: .rounded)).lineLimit(2).foregroundStyle(.white)
                if let start = entry.start {
                    if entry.active { Label("Plan en directo", systemImage: "circle.fill").font(.caption2).foregroundStyle(.green) }
                    else { Text(start, style: .relative).font(.system(size: 13, weight: .medium, design: .rounded)).foregroundStyle(.white.opacity(0.7)) }
                    Text(start, format: .dateTime.day().month(.abbreviated).hour().minute()).font(.caption2).foregroundStyle(.white.opacity(0.55))
                } else { Text("Abre la agenda para organizar el siguiente.").font(.caption).foregroundStyle(.white.opacity(0.65)) }
            }
            if family != .systemSmall {
                Image("Chota").resizable().interpolation(.none).scaledToFit().frame(width: 80, height: 110).accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { LinearGradient(colors: [Color(red: 0.09, green: 0.1, blue: 0.12), Color(red: 0.04, green: 0.05, blue: 0.06)], startPoint: .topLeading, endPoint: .bottomTrailing) }
        .widgetURL(entry.link)
    }
}
struct ClubNextPlanWidget: Widget {
    let kind = "ClubNextPlan"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PlanProvider()) { PlanWidgetView(entry: $0) }
            .configurationDisplayName("El Chota y tu próximo plan")
            .description("La cuenta atrás del próximo plan del club.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
struct ClubPlanLiveWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ClubPlanAttributes.self) { context in
            HStack(spacing: 14) {
                Image("Chota").resizable().interpolation(.none).scaledToFit().frame(width: 52, height: 65)
                VStack(alignment: .leading, spacing: 5) {
                    Text("EL CLUB · EN DIRECTO").font(.caption2.bold()).foregroundStyle(accent)
                    Text(context.state.title).font(.headline).lineLimit(2)
                    Text(context.state.start, style: .time).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "person.2.fill").foregroundStyle(accent)
            }.padding(16).activityBackgroundTint(Color(red: 0.07, green: 0.08, blue: 0.1)).activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "bigboyrules://plan?id=\(context.attributes.eventID)"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "person.2.fill").foregroundStyle(accent) }
                DynamicIslandExpandedRegion(.trailing) { Text("EN DIRECTO").font(.caption2.bold()).foregroundStyle(accent) }
                DynamicIslandExpandedRegion(.bottom) { Text(context.state.title).font(.headline).lineLimit(2).padding(.bottom, 10) }
            } compactLeading: { Image(systemName: "person.2.fill").foregroundStyle(accent) }
            compactTrailing: { Text(context.state.start, style: .timer).monospacedDigit().frame(maxWidth: 50).foregroundStyle(accent) }
            minimal: { Image(systemName: "person.2.fill").foregroundStyle(accent) }
            .widgetURL(URL(string: "bigboyrules://plan?id=\(context.attributes.eventID)"))
        }
    }
}
@main
struct ClubPlanWidgetBundle: WidgetBundle {
    var body: some Widget { ClubNextPlanWidget(); ClubPlanLiveWidget() }
}
