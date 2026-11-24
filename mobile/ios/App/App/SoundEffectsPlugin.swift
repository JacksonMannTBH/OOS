import AVFoundation
import Capacitor
import UIKit

@objc(OOSSoundEffectsPlugin)
public class SoundEffectsPlugin: CAPPlugin, CAPBridgedPlugin, AVAudioPlayerDelegate {
    public let identifier = "OOSSoundEffectsPlugin"
    public let jsName = "OOSSoundEffects"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "preloadPig", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playPig", returnType: CAPPluginReturnPromise)
    ]
    private var player: AVAudioPlayer?
    private var previousAudio: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?
    private var pauseObserver: NSObjectProtocol?

    public override func load() {
        pauseObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in self?.stopSound() }
    }

    private func pigPlayer() throws -> AVAudioPlayer {
        if let player { return player }
        guard let url = Bundle.main.url(forResource: "mudchute-pig-3", withExtension: "wav", subdirectory: "public/audio") else {
            throw NSError(domain: "OutOfSight.Sound", code: 1, userInfo: [NSLocalizedDescriptionKey: "Pig sound is missing."])
        }
        let sound = try AVAudioPlayer(contentsOf: url)
        sound.delegate = self
        sound.volume = 1
        player = sound
        return sound
    }

    @objc func preloadPig(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do { _ = try self.pigPlayer(); call.resolve() }
            catch { call.reject("Couldn’t load the pig sound.", nil, error) }
        }
    }

    @objc func playPig(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard UIApplication.shared.applicationState == .active else {
                call.resolve(["played": false]); return
            }
            do {
                let sound = try self.pigPlayer()
                let session = AVAudioSession.sharedInstance()
                if self.previousAudio == nil {
                    self.previousAudio = (session.category, session.mode, session.categoryOptions)
                }
                // An intentional sound uses media volume, including in Silent mode.
                // Mix briefly with music or navigation rather than interrupting it.
                try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)
                sound.currentTime = 0
                sound.prepareToPlay()
                let played = sound.play()
                if !played { self.stopSound() }
                call.resolve(["played": played, "duration": sound.duration])
            } catch {
                self.stopSound()
                call.reject("Couldn’t play the pig sound.", nil, error)
            }
        }
    }

    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) { stopSound() }
    public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) { stopSound() }

    private func stopSound() {
        player?.stop()
        guard let previous = previousAudio else { return }
        previousAudio = nil
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false, options: [.notifyOthersOnDeactivation])
        try? session.setCategory(previous.0, mode: previous.1, options: previous.2)
    }

    deinit { if let pauseObserver { NotificationCenter.default.removeObserver(pauseObserver) } }
}
