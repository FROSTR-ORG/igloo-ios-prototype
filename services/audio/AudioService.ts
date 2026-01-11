import { Platform } from 'react-native';
import { BackgroundAudioModule } from '@/modules/background-audio';

/**
 * AudioService - Wrapper for native BackgroundAudioModule.
 * Uses Expo Modules API with native Swift/AVAudioPlayer for reliable iOS background audio playback.
 */
class AudioService {
  private isPlaying: boolean = false;

  /**
   * Initialize - check if module is available.
   */
  async initialize(): Promise<void> {
    console.log('[AudioService] Initializing...');
    console.log('[AudioService] Platform:', Platform.OS);
    console.log('[AudioService] BackgroundAudioModule:', BackgroundAudioModule);

    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      console.log('[AudioService] Expo BackgroundAudioModule available');
    } else if (__DEV__) {
      console.warn('[AudioService] Module not available - ensure you are running a development build (npx expo run:ios)');
    }
  }

  /**
   * Start playing background audio.
   * Safe to call multiple times - will only start if not already playing.
   */
  async play(): Promise<void> {
    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      try {
        // Check native state in case JS state is out of sync
        const nativeIsPlaying = await BackgroundAudioModule.isPlaying();
        if (nativeIsPlaying) {
          console.log('[AudioService] Already playing (native confirmed)');
          this.isPlaying = true;
          return;
        }

        if (this.isPlaying) {
          console.log('[AudioService] Already playing (JS state)');
          return;
        }

        console.log('[AudioService] Calling native play...');
        await BackgroundAudioModule.play();
        this.isPlaying = true;
        console.log('[AudioService] Native playback started');
      } catch (error) {
        console.error('[AudioService] Failed to start native playback:', error);
        throw error;
      }
    } else {
      console.warn('[AudioService] Cannot play - module not available');
    }
  }

  /**
   * Stop playing background audio.
   */
  async stop(): Promise<void> {
    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      try {
        // Check native state in case JS state is out of sync
        const nativeIsPlaying = await BackgroundAudioModule.isPlaying();
        if (!nativeIsPlaying && !this.isPlaying) {
          return;
        }

        await BackgroundAudioModule.stop();
        this.isPlaying = false;
        console.log('[AudioService] Native playback stopped');
      } catch (error) {
        console.error('[AudioService] Failed to stop native playback:', error);
        this.isPlaying = false;
      }
    }
  }

  /**
   * Check if audio is currently playing (cached JS state).
   * May be out of sync with native state in edge cases.
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Check if audio is currently playing (queries native state).
   * Use this for accurate state when native/JS sync matters.
   */
  async getIsPlayingAsync(): Promise<boolean> {
    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      try {
        const nativeIsPlaying = await BackgroundAudioModule.isPlaying();
        // Sync JS state with native state
        this.isPlaying = nativeIsPlaying;
        return nativeIsPlaying;
      } catch (error) {
        console.error('[AudioService] Failed to check native playing state:', error);
        return this.isPlaying;
      }
    }
    return this.isPlaying;
  }

  /**
   * Set the playback volume (0.0 to 1.0).
   */
  async setVolume(volume: number): Promise<void> {
    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      try {
        await BackgroundAudioModule.setVolume(volume);
      } catch (error) {
        console.error('[AudioService] Failed to set volume:', error);
      }
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();
