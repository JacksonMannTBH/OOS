import ActivityKit
import SwiftUI
import WidgetKit

@main
struct OOSWidgetBundle: WidgetBundle {
    var body: some Widget {
        OOSHomeScreenWidget()
        OOSLiveTrackingWidget()
    }
}

struct OOSLiveTrackingWidget: Widget {
    var body: some WidgetConfiguration {
        if #available(iOSApplicationExtension 18.0, *) {
            return activityConfiguration.supplementalActivityFamilies([.small])
        } else {
            return activityConfiguration
        }
    }

    private var activityConfiguration: some WidgetConfiguration {
        ActivityConfiguration(for: RideTrackingAttributes.self) { context in
            if #available(iOSApplicationExtension 18.0, *) {
                SupplementalLiveTrackingView(
                    content: context.state,
                    status: label(context),
                    tint: tint(context),
                    lockScreenContent: lockScreenContent(context)
                )
            } else {
                lockScreenContent(context)
            }
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(label(context).isEmpty ? "Live tracking" : label(context))
                        .font(.custom("Manrope-Bold", size: 22, relativeTo: .title2))
                        .foregroundStyle(tint(context)).lineLimit(1).minimumScaleFactor(0.5)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.distanceValueLabel)
                        .font(.custom("Manrope-Bold", size: 20, relativeTo: .title3))
                        .monospacedDigit().foregroundStyle(tint(context))
                        .lineLimit(1).minimumScaleFactor(0.5)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.aircraft).font(.custom("Manrope-Bold", size: 17, relativeTo: .headline)).lineLimit(1)
                        Spacer()
                        AircraftDirectionLabel(content: context.state)
                            .font(.custom("Manrope-Bold", size: 20, relativeTo: .title3))
                            .foregroundStyle(tint(context))
                    }
                    .padding(.top, 4)
                    .foregroundStyle(.white)
                }
            } compactLeading: {
                Text(label(context))
                    .font(.custom("Manrope-Bold", size: 11, relativeTo: .caption2)).foregroundStyle(tint(context))
            } compactTrailing: {
                Text(compactDistance(context))
                    .font(.custom("Manrope-Bold", size: 11, relativeTo: .caption2)).monospacedDigit().foregroundStyle(tint(context))
            } minimal: {
                Image(systemName: "airplane").foregroundStyle(tint(context))
                    .accessibilityLabel("OOS \(label(context)), \(distance(context))")
            }
            .widgetURL(URL(string: "oos://home"))
            .keylineTint(tint(context))
        }
    }

    private func lockScreenContent(_ context: ActivityViewContext<RideTrackingAttributes>) -> some View {
        LockScreenLiveTrackingView(content: context.state, status: label(context), tint: tint(context))
        .activityBackgroundTint(tint(context, brightness: 0.28))
        .activitySystemActionForegroundColor(.white)
        .widgetURL(URL(string: "oos://home"))
    }

    private func label(_ context: ActivityViewContext<RideTrackingAttributes>) -> String {
        context.state.hasKnownRideState ? context.state.rideState.uppercased() : ""
    }
    private func distance(_ context: ActivityViewContext<RideTrackingAttributes>) -> String {
        context.state.distanceLabel
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

private struct LockScreenLiveTrackingView: View {
    let content: RideTrackingContent
    let status: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(status.isEmpty ? "Live tracking" : status)
                    .font(.custom("Manrope-Bold", size: 26, relativeTo: .title2))
                    .lineLimit(1).minimumScaleFactor(0.5)
                Spacer(minLength: 0)
                Text(content.distanceValueLabel)
                    .font(.custom("Manrope-Bold", size: 22, relativeTo: .title2))
                    .monospacedDigit().lineLimit(1).minimumScaleFactor(0.5)
            }
            .foregroundStyle(tint)

            if content.hasKnownRideState {
                HStack(alignment: .bottom, spacing: 12) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 4) {
                            Text("Updated")
                            Text(content.updatedAt, style: .time)
                        }
                        .font(.custom("Manrope-Regular", size: 11, relativeTo: .caption2))
                        .foregroundStyle(Color.white.opacity(0.65))
                        .lineLimit(1).minimumScaleFactor(0.7)
                        Text(content.aircraft)
                            .font(.custom("Manrope-Bold", size: 17, relativeTo: .headline))
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    AircraftDirectionLabel(content: content)
                        .font(.custom("Manrope-Bold", size: 22, relativeTo: .title2))
                        .foregroundStyle(tint)
                }
            }
        }
        .padding(16)
        .foregroundStyle(.white)
        .accessibilityElement(children: .combine)
    }
}

// True-north bearing from the user's position to the aircraft.
private struct AircraftDirectionLabel: View {
    let content: RideTrackingContent

    var body: some View {
        if let direction = content.direction, let bearing = content.bearingDegrees {
            HStack(spacing: 5) {
                Image(systemName: "arrow.up")
                    .rotationEffect(.degrees(bearing))
                    .frame(width: 18, height: 18)
                    .accessibilityHidden(true)
                Text(direction)
            }
            .fixedSize()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Aircraft direction from you: \(direction)")
        }
    }
}

// The small family is shared by CarPlay Dashboard (iOS 26+) and the Apple Watch
// Smart Stack. Use the phone's Lock Screen presentation for medium.
@available(iOSApplicationExtension 18.0, *)
private struct SupplementalLiveTrackingView<LockScreenContent: View>: View {
    @Environment(\.activityFamily) private var activityFamily

    let content: RideTrackingContent
    let status: String
    let tint: Color
    let lockScreenContent: LockScreenContent

    var body: some View {
        if activityFamily == .small {
            SmallLiveTrackingView(content: content, status: status, tint: tint)
        } else {
            lockScreenContent
        }
    }
}

private struct SmallLiveTrackingView: View {
    @Environment(\.colorScheme) private var colorScheme

    let content: RideTrackingContent
    let status: String
    let tint: Color

    private var statusColor: Color {
        guard colorScheme == .light else { return tint }
        // Keep the status hues readable against CarPlay's light cards.
        switch content.rideState {
        case "Stop": return Color(red: 0.70, green: 0.12, blue: 0.14)
        case "Warning": return tint
        case "Watch": return Color(red: 0.16, green: 0.37, blue: 0.67)
        case "Clear": return Color(red: 0.10, green: 0.43, blue: 0.25)
        default: return .primary
        }
    }

    private var statusText: Text {
        Text(status.isEmpty ? "Live tracking" : status)
            .font(.system(.title3, design: .rounded, weight: .bold))
            .foregroundColor(status.isEmpty ? .primary : statusColor)
    }

    private var distanceText: Text {
        Text(content.distanceValueLabel)
            .font(.system(.title3, design: .rounded, weight: .bold))
            .monospacedDigit()
    }

    private var aircraftLabel: some View {
        Text(content.aircraft)
            .font(.system(.footnote, weight: .semibold))
            .lineLimit(1).minimumScaleFactor(0.8)
    }

    private var updatedLabel: some View {
        Text("Updated \(Text(content.updatedAt, style: .time))")
        .font(.system(.caption, weight: .medium))
        .foregroundStyle(Color.primary.opacity(0.8))
        .lineLimit(1).minimumScaleFactor(0.5)
    }

    @ViewBuilder
    private func directionLabel(compact: Bool = false) -> some View {
        if let direction = content.direction, let bearing = content.bearingDegrees {
            HStack(spacing: compact ? 3 : 5) {
                Image(systemName: "arrow.up")
                    .rotationEffect(.degrees(bearing))
                    .frame(width: compact ? 14 : 18, height: compact ? 14 : 18)
                    .accessibilityHidden(true)
                Text(direction)
            }
            .font(.system(compact ? .subheadline : .title3, design: .rounded, weight: .bold))
            .fixedSize()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Aircraft direction from you: \(direction)")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    statusText.fixedSize()
                    Spacer(minLength: 0)
                    distanceText.fixedSize()
                }
                // Scale both readings together when the regular row cannot fit,
                // so the status stays complete at narrow widths or larger type.
                Text("\(Text(status.isEmpty ? "Live tracking" : status).foregroundColor(status.isEmpty ? .primary : statusColor))  \(Text(content.distanceValueLabel).monospacedDigit())")
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .lineLimit(1).minimumScaleFactor(0.4)
            }

            if content.hasKnownRideState {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .bottom, spacing: 8) {
                        VStack(alignment: .leading, spacing: 4) {
                            aircraftLabel
                            updatedLabel.fixedSize(horizontal: true, vertical: false)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        directionLabel()
                    }
                    HStack(alignment: .bottom, spacing: 8) {
                        VStack(alignment: .leading, spacing: 4) {
                            aircraftLabel
                            ViewThatFits(in: .horizontal) {
                                updatedLabel.fixedSize(horizontal: true, vertical: false)
                                Text(content.updatedAt, style: .time)
                                    .font(.system(.caption, weight: .medium))
                                    .foregroundStyle(Color.primary.opacity(0.8))
                                    .lineLimit(1).minimumScaleFactor(0.5)
                                    .accessibilityLabel(Text("Updated \(Text(content.updatedAt, style: .time))"))
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        directionLabel(compact: true)
                    }
                }
            } else if !status.isEmpty {
                aircraftLabel
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // The small Live Activity does not inherit a widget's content margins.
        // Keep all readings inside the rounded card on the vehicle display.
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .foregroundStyle(Color.primary)
        .widgetURL(URL(string: "oos://home"))
        .accessibilityElement(children: .combine)
    }
}
