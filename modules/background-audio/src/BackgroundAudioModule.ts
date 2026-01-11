import { NativeModule, requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

declare class BackgroundAudioModuleType extends NativeModule {
  play(): Promise<boolean>;
  stop(): Promise<boolean>;
  setVolume(volume: number): Promise<boolean>;
  isPlaying(): Promise<boolean>;
}

// Gracefully handle missing native module (e.g., when running in Expo Go)
let BackgroundAudioModule: BackgroundAudioModuleType | null = null;

if (Platform.OS === 'ios') {
  try {
    BackgroundAudioModule = requireNativeModule<BackgroundAudioModuleType>('BackgroundAudio');
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[BackgroundAudio] Native module not available. ' +
        'This is expected in Expo Go. Use `npx expo run:ios` for a development build.',
        error
      );
    }
  }
}

export default BackgroundAudioModule;
