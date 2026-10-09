import SwiftUI
import WidgetKit

struct HomeScreenEntry: TimelineEntry {
    let date: Date
    let state: HomeWidgetState

    static var sample: Self {
        Self(date: Date(), state: HomeWidgetState(configuration: RideTrackingConfiguration(
            stateCode: "WA", stateName: "Washington", excludedTails: [], watchNm: 10, warningNm: 5, stopNm: 2),
            content: RideTrackingContent(
            aircraft: "Plane N102LP", distanceNm: 6.8, rideState: "Watch", message: "Cessna 182T",
            updatedAt: Date(), validUntil: Date().addingTimeInterval(30), stateName: "Washington",
            aircraftTail: "N102LP", vehicleLabel: "Plane")))
    }
}

struct HomeScreenProvider: TimelineProvider {
    func placeholder(in context: Context) -> HomeScreenEntry { .sample }

    func getSnapshot(in context: Context, completion: @escaping (HomeScreenEntry) -> Void) {
        completion(context.isPreview ? .sample : HomeScreenEntry(date: Date(), state: HomeWidgetStore.shared.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HomeScreenEntry>) -> Void) {
        Task { @MainActor in
            if let configuration = HomeWidgetStore.shared.read().configuration {
                _ = await HomeWidgetRefresh.refresh(configuration: configuration, forWidget: true)
            }
            let now = Date()
            let entry = HomeScreenEntry(date: now, state: HomeWidgetStore.shared.read())
            // A refresh request, not a promise: iOS chooses the actual schedule.
            completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(15 * 60))))
        }
    }
}

struct OOSHomeScreenWidget: Widget {
    private var configuration: some WidgetConfiguration {
        StaticConfiguration(kind: HomeWidgetStore.kind, provider: HomeScreenProvider()) { entry in
            HomeScreenWidgetView(entry: entry)
        }
        .configurationDisplayName("OOS Aircraft")
        .description("Nearest aircraft, distance, and your last known ride state.")
        .supportedFamilies([.systemSmall])
    }

    var body: some WidgetConfiguration {
        configuration.contentMarginsDisabled()
    }
}

struct HomeScreenWidgetView: View {
    let entry: HomeScreenEntry
    private var content: RideTrackingContent? { entry.state.content }
    private var tint: Color {
        switch content?.rideState {
        case "Stop": return Color(red: 1, green: 0.30, blue: 0.31)
        case "Warning": return Color(red: 0.96, green: 0.77, blue: 0.19)
        case "Watch": return Color(red: 0.38, green: 0.65, blue: 0.98)
        case "Clear": return Color(red: 0.22, green: 0.85, blue: 0.54)
        default: return Color(red: 0.72, green: 0.70, blue: 0.65)
        }
    }
    private var background: Color {
        switch content?.rideState {
        case "Stop": return Color(red: 0.17, green: 0.07, blue: 0.09)
        case "Warning": return Color(red: 0.15, green: 0.13, blue: 0.07)
        case "Watch": return Color(red: 0.07, green: 0.11, blue: 0.17)
        case "Clear": return Color(red: 0.07, green: 0.15, blue: 0.11)
        default: return Color(red: 0.07, green: 0.07, blue: 0.05)
        }
    }
    private let ink = Color(red: 0.96, green: 0.95, blue: 0.90)
    private let secondary = Color(red: 0.72, green: 0.70, blue: 0.65)

    private var layout: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("OOS").font(.system(size: 12, weight: .heavy)).tracking(1.5)
                    .foregroundStyle(Color(red: 0.96, green: 0.77, blue: 0.19))
                Spacer(minLength: 6)
                Text(entry.state.configuration?.stateCode ?? "")
                    .font(.system(size: 11, weight: .medium)).foregroundStyle(secondary)
            }
            Spacer(minLength: 8)
            Text(content?.rideState.uppercased() ?? "OPEN OOS")
                .font(.system(size: 29, weight: .bold)).tracking(-0.6)
                .foregroundStyle(tint).lineLimit(1).minimumScaleFactor(0.7)
            if let content {
                if let distance = content.distanceNm {
                    (Text(String(format: "%.1f", distance)).font(.system(size: 17, weight: .semibold)) +
                     Text(" nm away").font(.system(size: 13)))
                        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.8).padding(.top, 5)
                } else {
                    Text("No aircraft airborne").font(.system(size: 13))
                        .lineLimit(2).padding(.top, 5)
                }
                if let tail = content.aircraftTail {
                    (Text("\(content.vehicleLabel ?? "Aircraft") ").font(.system(size: 12)).foregroundColor(secondary) +
                     Text(tail).font(.system(size: 14, weight: .semibold)))
                        .lineLimit(1).minimumScaleFactor(0.8).padding(.top, 5)
                }
            } else {
                Text(entry.state.configuration == nil ? "Set up location in Map" : "Open OOS to update")
                    .font(.system(size: 13)).foregroundStyle(secondary)
                    .lineLimit(2).padding(.top, 5)
            }
            Spacer(minLength: 8)
            if let content {
                HStack(spacing: 3) {
                    Text(content.validUntil < entry.date ? "Last update" : "Updated")
                    Text(content.updatedAt, style: .time)
                }.font(.system(size: 11)).foregroundStyle(secondary).lineLimit(1).minimumScaleFactor(0.8)
            } else {
                Text("Tap to open Home").font(.system(size: 11)).foregroundStyle(secondary)
            }
        }
        .padding(16).foregroundStyle(ink)
        .widgetURL(URL(string: "oos://home"))
        .accessibilityElement(children: .combine)
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            layout.containerBackground(for: .widget) { background }
        } else { layout.background(background) }
    }
}
