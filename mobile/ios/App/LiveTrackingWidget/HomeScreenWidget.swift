import SwiftUI
import WidgetKit

struct HomeScreenEntry: TimelineEntry {
    let date: Date
}

struct HomeScreenProvider: TimelineProvider {
    func placeholder(in context: Context) -> HomeScreenEntry { HomeScreenEntry(date: Date()) }

    func getSnapshot(in context: Context, completion: @escaping (HomeScreenEntry) -> Void) {
        completion(HomeScreenEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HomeScreenEntry>) -> Void) {
        // This launcher needs no location, aircraft data, or scheduled refreshes.
        completion(Timeline(entries: [HomeScreenEntry(date: Date())], policy: .never))
    }
}

struct OOSHomeScreenWidget: Widget {
    var body: some WidgetConfiguration {
        // Preserve the kind so existing Home Screen placements receive the new design.
        StaticConfiguration(kind: HomeWidgetStore.kind, provider: HomeScreenProvider()) { _ in
            HomeScreenWidgetView()
        }
        .configurationDisplayName("OOS Ride")
        .description("Start Ride? Tap to open Ride Mode.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct HomeScreenWidgetView: View {
    private let accent = Color(red: 0.96, green: 0.77, blue: 0.19)
    private let background = Color(red: 0.07, green: 0.07, blue: 0.05)
    private let ink = Color(red: 0.96, green: 0.95, blue: 0.90)

    private var layout: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Image("OOSLogo")
                    .resizable().scaledToFill()
                    .frame(width: 48, height: 24).clipped()
                    .blendMode(.screen)
                    .accessibilityHidden(true)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(background)
                    .frame(width: 28, height: 28)
                    .background(accent, in: Circle())
            }
            .foregroundStyle(accent)
            Spacer(minLength: 8)
            Text("Start\nRide?")
                .font(.custom("Manrope-Bold", size: 40, relativeTo: .largeTitle)).tracking(-0.6)
                .multilineTextAlignment(.center)
                .lineLimit(2).minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)
        }
        .padding(16).foregroundStyle(ink)
        .widgetURL(URL(string: "oos://ride"))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("OOS. Start Ride?")
        .accessibilityHint("Opens Ride Mode")
        .accessibilityAddTraits(.isLink)
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            layout.containerBackground(for: .widget) { background }
        } else { layout.background(background) }
    }
}
