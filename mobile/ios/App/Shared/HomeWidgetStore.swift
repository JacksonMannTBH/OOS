import Foundation

// The app and widget share only preferences and the last calculated result.
// GPS coordinates remain in memory and never enter this file or an API request.
struct HomeWidgetState: Codable {
    var configuration: RideTrackingConfiguration?
    var content: RideTrackingContent?
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
