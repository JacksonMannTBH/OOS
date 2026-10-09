import ActivityKit
import SwiftUI
import WidgetKit

@main
struct OOSLiveTrackingWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RideTrackingAttributes.self) { context in
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Label("OOS · \(context.state.stateName)", systemImage: "airplane")
                        .font(.caption.weight(.bold)).foregroundStyle(Color.white.opacity(0.65)).lineLimit(1)
                    Spacer()
                    Text(label(context)).font(.headline).foregroundStyle(tint(context))
                }
                HStack(spacing: 4) {
                    Text("Updated")
                    Text(context.state.updatedAt, style: .time)
                }
                .font(.caption2).foregroundStyle(Color.white.opacity(0.65))
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.aircraft).font(.headline).lineLimit(1)
                        Text(context.state.message)
                            .font(.caption).foregroundStyle(Color.white.opacity(0.65)).lineLimit(1)
                    }
                    Spacer(minLength: 12)
                    Text(distance(context)).font(.title2.weight(.bold)).monospacedDigit().foregroundStyle(tint(context))
                }
            }
            .padding(16)
            .foregroundStyle(.white)
            .activityBackgroundTint(tint(context, brightness: 0.28))
            .activitySystemActionForegroundColor(.white)
            .widgetURL(URL(string: "oos://home"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("OOS · \(context.state.stateName)", systemImage: "airplane")
                        .font(.caption.weight(.bold)).lineLimit(1).foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(label(context)).font(.headline).foregroundStyle(tint(context))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(context.state.aircraft).font(.headline).lineLimit(1)
                            Text(context.state.message)
                                .font(.caption).foregroundStyle(Color.white.opacity(0.65)).lineLimit(1)
                        }
                        Spacer()
                        Text(distance(context)).font(.title3.weight(.bold)).monospacedDigit().foregroundStyle(tint(context))
                    }
                    .padding(.top, 4)
                    .foregroundStyle(.white)
                }
            } compactLeading: {
                Text(label(context))
                    .font(.caption2.weight(.bold)).foregroundStyle(tint(context))
            } compactTrailing: {
                Text(compactDistance(context))
                    .font(.caption2.weight(.bold)).monospacedDigit().foregroundStyle(tint(context))
            } minimal: {
                Image(systemName: "airplane").foregroundStyle(tint(context))
                    .accessibilityLabel("OOS \(label(context)), \(distance(context))")
            }
            .widgetURL(URL(string: "oos://home"))
            .keylineTint(tint(context))
        }
    }

    private func label(_ context: ActivityViewContext<RideTrackingAttributes>) -> String {
        context.state.rideState.uppercased()
    }
    private func distance(_ context: ActivityViewContext<RideTrackingAttributes>) -> String {
        guard let distance = context.state.distanceNm else { return "— nm" }
        return String(format: "%.1f nm", distance)
    }
    private func compactDistance(_ context: ActivityViewContext<RideTrackingAttributes>) -> String {
        guard let distance = context.state.distanceNm else { return "—" }
        return String(format: "%.1f", distance)
    }
    private func tint(_ context: ActivityViewContext<RideTrackingAttributes>, brightness: Double = 1) -> Color {
        switch context.state.rideState {
        case "Stop": return Color(red: 1 * brightness, green: 0.30 * brightness, blue: 0.31 * brightness)
        case "Warning": return Color(red: 0.96 * brightness, green: 0.77 * brightness, blue: 0.19 * brightness)
        case "Watch": return Color(red: 0.38 * brightness, green: 0.65 * brightness, blue: 0.98 * brightness)
        case "Clear": return Color(red: 0.22 * brightness, green: 0.85 * brightness, blue: 0.54 * brightness)
        default: return .gray
        }
    }
}
