import ExpoModulesCore
import AVFoundation

// Separate delegate class since Module can't inherit from NSObject
private class AudioPlayerDelegate: NSObject, AVAudioPlayerDelegate {
  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    print("[BackgroundAudio] Delegate: finished playing, success: \(flag)")
  }

  func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
    print("[BackgroundAudio] Delegate: DECODE ERROR: \(error?.localizedDescription ?? "unknown")")
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
      print("[BackgroundAudio] Module created")
      self.setupNotificationHandlers()
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
      return self.playing
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
    if let observer = interruptionObserver { NotificationCenter.default.removeObserver(observer) }
    if let observer = routeChangeObserver { NotificationCenter.default.removeObserver(observer) }
  }

  private func configureAndActivateAudioSession() throws {
    let session = AVAudioSession.sharedInstance()

    print("[BackgroundAudio] Current category: \(session.category.rawValue)")
    print("[BackgroundAudio] Current mode: \(session.mode.rawValue)")
    print("[BackgroundAudio] Is other audio playing: \(session.isOtherAudioPlaying)")

    try session.setCategory(.playback, mode: .default, options: [])
    try session.setActive(true, options: [])

    print("[BackgroundAudio] Audio session activated successfully")
    print("[BackgroundAudio] Output routes: \(session.currentRoute.outputs.map { $0.portName })")
  }

  private func handleInterruption(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
      print("[BackgroundAudio] Could not parse interruption notification")
      return
    }

    switch type {
    case .began:
      print("[BackgroundAudio] Interruption BEGAN")
    case .ended:
      print("[BackgroundAudio] Interruption ENDED")
      if playing {
        print("[BackgroundAudio] Attempting to resume playback...")
        do {
          try AVAudioSession.sharedInstance().setActive(true, options: [])
          let resumed = audioPlayer?.play() ?? false
          print("[BackgroundAudio] Resume result: \(resumed)")
        } catch {
          print("[BackgroundAudio] Failed to resume: \(error)")
        }
      }
    @unknown default:
      print("[BackgroundAudio] Unknown interruption type")
    }
  }

  private func handleRouteChange(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
      return
    }

    print("[BackgroundAudio] Route changed, reason: \(reason.rawValue)")
    let session = AVAudioSession.sharedInstance()
    print("[BackgroundAudio] New output routes: \(session.currentRoute.outputs.map { $0.portName })")

    // Resume playback if route changed but we should still be playing
    if playing && audioPlayer?.isPlaying == false {
      print("[BackgroundAudio] Player stopped due to route change, resuming...")
      audioPlayer?.play()
    }
  }

  @MainActor
  private func startPlayback() async throws -> Bool {
    print("[BackgroundAudio] ========== START PLAYBACK ==========")

    if playing && audioPlayer?.isPlaying == true {
      print("[BackgroundAudio] Already playing, skipping")
      return true
    }

    // Step 1: Configure audio session
    print("[BackgroundAudio] Step 1: Configuring audio session...")
    do {
      try configureAndActivateAudioSession()
    } catch {
      print("[BackgroundAudio] FAILED to configure audio session: \(error)")
      throw error
    }

    // Step 2: Find audio file
    print("[BackgroundAudio] Step 2: Looking for audio file...")
    guard let audioPath = Bundle.main.path(forResource: "hum", ofType: "wav") else {
      print("[BackgroundAudio] FAILED: Audio file 'hum.wav' not found in bundle!")
      print("[BackgroundAudio] Bundle path: \(Bundle.main.bundlePath)")
      throw NSError(domain: "BackgroundAudio", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Audio file not found"])
    }
    print("[BackgroundAudio] Found audio file at: \(audioPath)")

    // Step 3: Create player
    print("[BackgroundAudio] Step 3: Creating AVAudioPlayer...")
    do {
      let audioURL = URL(fileURLWithPath: audioPath)
      audioPlayer = try AVAudioPlayer(contentsOf: audioURL)
      audioPlayer?.delegate = audioDelegate
      audioPlayer?.numberOfLoops = -1
      audioPlayer?.volume = 0.3

      print("[BackgroundAudio] Player created successfully")
      print("[BackgroundAudio] - Duration: \(audioPlayer?.duration ?? 0) seconds")
      print("[BackgroundAudio] - Channels: \(audioPlayer?.numberOfChannels ?? 0)")
    } catch {
      print("[BackgroundAudio] FAILED to create player: \(error)")
      throw error
    }

    // Step 4: Prepare to play
    print("[BackgroundAudio] Step 4: Preparing to play...")
    let prepared = audioPlayer?.prepareToPlay() ?? false
    print("[BackgroundAudio] Prepare result: \(prepared)")

    // Step 5: Start playback
    print("[BackgroundAudio] Step 5: Starting playback...")
    let playResult = audioPlayer?.play() ?? false
    print("[BackgroundAudio] Play result: \(playResult)")

    if playResult {
      playing = true
      print("[BackgroundAudio] Playback started successfully!")
    } else {
      print("[BackgroundAudio] play() returned false - playback FAILED")
      throw NSError(domain: "BackgroundAudio", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "play() returned false"])
    }

    print("[BackgroundAudio] ========== END START PLAYBACK ==========")
    return true
  }

  @MainActor
  private func stopPlayback() async -> Bool {
    print("[BackgroundAudio] Stopping playback...")
    audioPlayer?.stop()
    audioPlayer = nil
    playing = false
    print("[BackgroundAudio] Playback stopped")
    return true
  }
}
