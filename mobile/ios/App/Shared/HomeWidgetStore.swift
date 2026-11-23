import Foundation

// The app and widget share only preferences and the last calculated result.
// GPS coordinates remain in memory and never enter this file or an API request.
struct HomeWidgetState: Codable {
    var configuration: RideTrackingConfiguration?
    var content: RideTrackingContent?
    var colorMode: OOSColorMode?
    var distancePalette: OOSDistancePalette?

    func liveContent(for configuration: RideTrackingConfiguration) -> RideTrackingContent {
        var result = RideTrackingContent.initial(stateName: configuration.stateName,
            previous: self.configuration == configuration ? content : nil)
        result.colorMode = colorMode
        result.distancePalette = distancePalette
        return result
    }
}

struct HomeWidgetStore {
    static let groupID = "group.live.outofsight.app"
    static let kind = "OOSHomeScreen"
    static var shared: Self {
        Self(directory: FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)?
            .appendingPathComponent("Library/Application Support/OOSWidgets", isDirectory: true))
    }
    let directory: URL?

    func read() -> HomeWidgetState {
        guard let file = directory?.appendingPathComponent("home-widget.json") else {
            return HomeWidgetState()
        }
        var result = HomeWidgetState()
        let coordinator = NSFileCoordinator()
        coordinator.coordinate(readingItemAt: file, options: [], error: nil) { url in
            if let data = try? Data(contentsOf: url),
               let decoded = try? JSONDecoder().decode(HomeWidgetState.self, from: data) {
                result = decoded
            }
        }
        return result
    }

    @discardableResult
    func setColorMode(_ mode: OOSColorMode) -> Bool {
        mutate { state in
            let stored: OOSColorMode? = mode == .color ? nil : mode
            guard state.colorMode != stored else { return false }
            state.colorMode = stored
            state.content?.colorMode = stored
            return true
        }
    }

    @discardableResult
    func setDistancePalette(_ palette: OOSDistancePalette) -> Bool {
        mutate { state in
            let stored: OOSDistancePalette? = palette == .classic ? nil : palette
            guard state.distancePalette != stored else { return false }
            state.distancePalette = stored
            state.content?.distancePalette = stored
            return true
        }
    }

    @discardableResult
    func configure(_ configuration: RideTrackingConfiguration) -> Bool {
        mutate { state in
            guard state.configuration != configuration else { return false }
            state.configuration = configuration
            // Old distances must not be relabeled for a different region or preferences.
            state.content = nil
            return true
        }
    }

    @discardableResult
    func publish(_ candidate: RideTrackingContent, for configuration: RideTrackingConfiguration) -> Bool {
        guard candidate.hasKnownRideState else { return false }
        return mutate { state in
            guard state.configuration == configuration else { return false }
            var candidate = candidate
            candidate.colorMode = state.colorMode
            candidate.distancePalette = state.distancePalette
            if let previous = state.content, previous.updatedAt > candidate.updatedAt { return false }
            guard state.content != candidate else { return false }
            state.content = candidate
            return true
        }
    }

    private func mutate(_ change: (inout HomeWidgetState) -> Bool) -> Bool {
        guard let directory else { return false }
        do { try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true) }
        catch { return false }
        let file = directory.appendingPathComponent("home-widget.json")
        var changed = false
        let coordinator = NSFileCoordinator()
        coordinator.coordinate(writingItemAt: file, options: .forMerging, error: nil) { url in
            var state = (try? Data(contentsOf: url)).flatMap { try? JSONDecoder().decode(HomeWidgetState.self, from: $0) }
                ?? HomeWidgetState()
            guard change(&state), let data = try? JSONEncoder().encode(state) else { return }
            do {
                try data.write(to: url, options: .atomic)
                changed = true
            } catch { /* A denied container must not interrupt the app or its Live Activity. */ }
        }
        return changed
    }
}
