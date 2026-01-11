import ExpoModulesCore
import AVFoundation

// Debug logging helper - only prints in DEBUG builds
private func debugLog(_ message: String) {
  #if DEBUG
  print("[BackgroundAudio] \(message)")
  #endif
}

// Separate delegate class since Module can't inherit from NSObject
private class AudioPlayerDelegate: NSObject, AVAudioPlayerDelegate {
  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    debugLog("Delegate: finished playing, success: \(flag)")
  }

  func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
    debugLog("Delegate: DECODE ERROR: \(error?.localizedDescription ?? "unknown")")
  }
}

public class BackgroundAudioModule: Module {
  private var audioPlayer: AVAudioPlayer?
  private var audioDelegate = AudioPlayerDelegate()
  private var playing: Bool = false
  private var interruptionObserver: NSObjectProtocol?
  private var routeChangeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("BackgroundAudio")

    OnCreate {
      debugLog("Module created")
      self.setupNotificationHandlers()
    }

    OnDestroy {
      debugLog("Module destroyed - cleaning up")
      self.cleanupNotificationHandlers()
    }

    AsyncFunction("play") { () -> Bool in
      return try await self.startPlayback()
    }

    AsyncFunction("stop") { () -> Bool in
      return await self.stopPlayback()
    }

    AsyncFunction("setVolume") { (volume: Double) -> Bool in
      await MainActor.run {
        self.audioPlayer?.volume = Float(max(0, min(1, volume)))
      }
      return true
    }

    AsyncFunction("isPlaying") { () -> Bool in
      return await MainActor.run {
        return self.playing
      }
    }
  }

  private func setupNotificationHandlers() {
    // Store observer tokens for cleanup in deinit
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      self?.handleInterruption(notification: notification)
    }

    routeChangeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      self?.handleRouteChange(notification: notification)
    }
  }

  deinit {
    cleanupNotificationHandlers()
  }

  private func cleanupNotificationHandlers() {
    if let observer = interruptionObserver {
      NotificationCenter.default.removeObserver(observer)
      interruptionObserver = nil
    }
    if let observer = routeChangeObserver {
      NotificationCenter.default.removeObserver(observer)
      routeChangeObserver = nil
    }
  }

  private func configureAndActivateAudioSession() throws {
    let session = AVAudioSession.sharedInstance()

    debugLog("Current category: \(session.category.rawValue)")
    debugLog("Current mode: \(session.mode.rawValue)")
    debugLog("Is other audio playing: \(session.isOtherAudioPlaying)")

    try session.setCategory(.playback, mode: .default, options: [])
    try session.setActive(true, options: [])

    debugLog("Audio session activated successfully")
    debugLog("Output routes: \(session.currentRoute.outputs.map { $0.portName })")
  }

  private func handleInterruption(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
      debugLog("Could not parse interruption notification")
      return
    }

    switch type {
    case .began:
      debugLog("Interruption BEGAN")
    case .ended:
      debugLog("Interruption ENDED")
      if playing {
        debugLog("Attempting to resume playback...")
        do {
          try AVAudioSession.sharedInstance().setActive(true, options: [])
          let resumed = audioPlayer?.play() ?? false
          debugLog("Resume result: \(resumed)")
          if !resumed {
            // Player failed to resume - update state to reflect reality
            debugLog("WARNING: Resume failed, updating playing state to false")
            playing = false
          }
        } catch {
          debugLog("Failed to resume audio session: \(error)")
          // Audio session activation failed - playback cannot continue
          playing = false
        }
      }
    @unknown default:
      debugLog("Unknown interruption type")
    }
  }

  private func handleRouteChange(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
      return
    }

    debugLog("Route changed, reason: \(reason.rawValue)")
    let session = AVAudioSession.sharedInstance()
    debugLog("New output routes: \(session.currentRoute.outputs.map { $0.portName })")

    // Resume playback if route changed but we should still be playing
    if playing && audioPlayer?.isPlaying == false {
      debugLog("Player stopped due to route change, resuming...")
      audioPlayer?.play()
    }
  }

  @MainActor
  private func startPlayback() async throws -> Bool {
    debugLog("========== START PLAYBACK ==========")

    if playing && audioPlayer?.isPlaying == true {
      debugLog("Already playing, skipping")
      return true
    }

    // Step 1: Configure audio session
    debugLog("Step 1: Configuring audio session...")
    do {
      try configureAndActivateAudioSession()
    } catch {
      debugLog("FAILED to configure audio session: \(error)")
      throw error
    }

    // Step 2: Find audio file
    debugLog("Step 2: Looking for audio file...")
    guard let audioPath = Bundle.main.path(forResource: "hum", ofType: "wav") else {
      debugLog("FAILED: Audio file 'hum.wav' not found in bundle!")
      debugLog("Bundle path: \(Bundle.main.bundlePath)")
      throw NSError(domain: "BackgroundAudio", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Audio file not found"])
    }
    debugLog("Found audio file at: \(audioPath)")

    // Step 3: Create player
    debugLog("Step 3: Creating AVAudioPlayer...")
    do {
      let audioURL = URL(fileURLWithPath: audioPath)
      audioPlayer = try AVAudioPlayer(contentsOf: audioURL)
      audioPlayer?.delegate = audioDelegate
      audioPlayer?.numberOfLoops = -1
      audioPlayer?.volume = 0.3

      debugLog("Player created successfully")
      debugLog("- Duration: \(audioPlayer?.duration ?? 0) seconds")
      debugLog("- Channels: \(audioPlayer?.numberOfChannels ?? 0)")
    } catch {
      debugLog("FAILED to create player: \(error)")
      throw error
    }

    // Step 4: Prepare to play
    debugLog("Step 4: Preparing to play...")
    let prepared = audioPlayer?.prepareToPlay() ?? false
    debugLog("Prepare result: \(prepared)")

    // Step 5: Start playback
    debugLog("Step 5: Starting playback...")
    let playResult = audioPlayer?.play() ?? false
    debugLog("Play result: \(playResult)")

    if playResult {
      playing = true
      debugLog("Playback started successfully!")
    } else {
      debugLog("play() returned false - playback FAILED")
      throw NSError(domain: "BackgroundAudio", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "play() returned false"])
    }

    debugLog("========== END START PLAYBACK ==========")
    return true
  }

  @MainActor
  private func stopPlayback() async -> Bool {
    debugLog("Stopping playback...")
    audioPlayer?.stop()
    audioPlayer = nil
    playing = false

    // Deactivate audio session so other apps (Music, Spotify) can resume
    do {
      try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
      debugLog("Audio session deactivated")
    } catch {
      debugLog("Failed to deactivate audio session: \(error)")
      // Non-fatal - continue with stop
    }

    debugLog("Playback stopped")
    return true
  }
}
