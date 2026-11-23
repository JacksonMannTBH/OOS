import SwiftUI
import WidgetKit

struct HomeScreenEntry: TimelineEntry {
    let date: Date
    var colorMode: OOSColorMode = .color
}

struct HomeScreenProvider: TimelineProvider {
    func placeholder(in context: Context) -> HomeScreenEntry { HomeScreenEntry(date: Date()) }

    func getSnapshot(in context: Context, completion: @escaping (HomeScreenEntry) -> Void) {
        completion(entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HomeScreenEntry>) -> Void) {
        // This launcher needs no location, aircraft data, or scheduled refreshes.
        completion(Timeline(entries: [entry()], policy: .never))
    }

    private func entry() -> HomeScreenEntry {
        HomeScreenEntry(date: Date(), colorMode: HomeWidgetStore.shared.read().colorMode ?? .color)
    }
}

struct OOSHomeScreenWidget: Widget {
    var body: some WidgetConfiguration {
        // Preserve the kind so existing Home Screen placements receive the new design.
        StaticConfiguration(kind: HomeWidgetStore.kind, provider: HomeScreenProvider()) { entry in
            HomeScreenWidgetView(colorMode: entry.colorMode)
        }
        .configurationDisplayName("OOS Ride")
        .description("Start Ride? Tap to open Ride Mode.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct HomeScreenWidgetView: View {
    var colorMode: OOSColorMode = .color
    private var accent: Color { colorMode.accent() }
    private let background = Color(red: 0.07, green: 0.07, blue: 0.05)
    private let ink = Color(red: 0.96, green: 0.95, blue: 0.90)

    private var layout: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                if colorMode == .color {
                    Image("OOSLogo")
                        .resizable().scaledToFill()
                        .frame(width: 48, height: 24).clipped()
                        .blendMode(.screen)
                        .accessibilityHidden(true)
                } else {
                    Canvas { context, size in
                        context.scaleBy(x: size.width / 48, y: size.height / 32)
                        var eye = Path()
                        eye.move(to: CGPoint(x: 0, y: 16))
                        eye.addCurve(to: CGPoint(x: 24, y: 0), control1: CGPoint(x: 6, y: 5), control2: CGPoint(x: 15, y: 0))
                        eye.addCurve(to: CGPoint(x: 48, y: 16), control1: CGPoint(x: 33, y: 0), control2: CGPoint(x: 42, y: 5))
                        eye.addCurve(to: CGPoint(x: 24, y: 32), control1: CGPoint(x: 42, y: 27), control2: CGPoint(x: 33, y: 32))
                        eye.addCurve(to: CGPoint(x: 0, y: 16), control1: CGPoint(x: 15, y: 32), control2: CGPoint(x: 6, y: 27))
                        context.fill(eye, with: .color(.white))
                        context.fill(Path(ellipseIn: CGRect(x: 14.5, y: 6.5, width: 19, height: 19)), with: .color(accent))
                        context.fill(Path(ellipseIn: CGRect(x: 19.9, y: 11.9, width: 8.2, height: 8.2)), with: .color(.black))
                    }
                    .frame(width: 48, height: 24)
                    .accessibilityHidden(true)
                }
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
                .font(.custom("SpaceGrotesk-Regular", size: 40, relativeTo: .largeTitle)).tracking(-0.6)
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
