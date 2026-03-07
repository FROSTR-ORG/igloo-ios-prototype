import * as Haptics from 'expo-haptics';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import {
  AccessibilityActionEvent,
  GestureResponderEvent,
  Pressable,
  Text,
  View,
} from 'react-native';

interface VolumeControlProps {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

// Clamp value between 0 and 1
const clamp = (val: number) => Math.max(0, Math.min(1, val));
export const MIN_MUTED_VOLUME = 0.005;
export const normalizeVolume = (val: number) => {
  const clampedValue = clamp(val);
  return clampedValue < MIN_MUTED_VOLUME ? 0 : clampedValue;
};
export const isMutedVolume = (val: number | undefined | null) =>
  val !== undefined && val !== null && normalizeVolume(val) === 0;

export function VolumeControl({ value, onValueChange, disabled }: VolumeControlProps) {
  const normalizedValue = normalizeVolume(value);
  const isMuted = isMutedVolume(normalizedValue);
  const previousVolume = useRef(normalizedValue > 0 ? normalizedValue : 0.3);

  // Track layout for position calculations (measured via onLayout for immediate availability)
  const trackRef = useRef<View>(null);
  const trackLayout = useRef({ x: 0, width: 0 });

  const handleTrackLayout = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackLayout.current = { x, width };
    });
  }, []);

  const handleMuteToggle = useCallback(async () => {
    if (disabled) return;
    await Haptics.selectionAsync();

    if (isMuted) {
      // Unmute - restore previous volume
      const restoreValue = previousVolume.current > 0 ? previousVolume.current : 0.3;
      onValueChange(restoreValue);
    } else {
      // Mute - save current volume and set to 0
      previousVolume.current = normalizedValue;
      onValueChange(0);
    }
  }, [disabled, isMuted, normalizedValue, onValueChange]);

  const calculateValueFromTouch = useCallback((pageX: number): number => {
    const { x, width } = trackLayout.current;
    if (width === 0) return normalizedValue;
    const touchX = pageX - x;
    return normalizeVolume(touchX / width);
  }, [normalizedValue]);

  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    if (disabled) return;

    const pageX = event.nativeEvent.pageX;

    // Measure and calculate in callback to avoid race condition with stale layout
    trackRef.current?.measureInWindow((x, _y, width) => {
      if (width > 0) {
        trackLayout.current = { x, width };
        const touchX = pageX - x;
        const newValue = normalizeVolume(touchX / width);
        onValueChange(newValue);
        if (newValue > 0) {
          previousVolume.current = newValue;
        }
      }
    });

    Haptics.selectionAsync();
  }, [disabled, onValueChange]);

  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    if (disabled) return;
    const newValue = calculateValueFromTouch(event.nativeEvent.pageX);
    onValueChange(newValue);
    if (newValue > 0) {
      previousVolume.current = newValue;
    }
  }, [disabled, calculateValueFromTouch, onValueChange]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    Haptics.selectionAsync();
  }, [disabled]);

  /**
   * Handles accessibility actions for VoiceOver/TalkBack gestures.
   * Supports increment, decrement, and set actions to adjust volume.
   */
  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (disabled) return;

      const step = 0.05; // 5% volume step
      let newValue = normalizedValue;

      switch (event.nativeEvent.actionName) {
        case 'increment':
          newValue = normalizeVolume(normalizedValue + step);
          break;
        case 'decrement':
          newValue = normalizeVolume(normalizedValue - step);
          break;
        case 'set':
          // For set action, we could use a default increment
          // or handle it based on the event's value if available
          newValue = normalizeVolume(normalizedValue + step);
          break;
        default:
          return;
      }

      onValueChange(newValue);
      if (newValue > 0) {
        previousVolume.current = newValue;
      }
      Haptics.selectionAsync();
    },
    [disabled, normalizedValue, onValueChange],
  );

  const percentage = Math.round(normalizedValue * 100);

  return (
    <View className="py-2">
      <View className="flex-row justify-between mb-3">
        <Text className="text-sm text-gray-400">Volume</Text>
        <Text className="text-sm text-gray-100">
          {isMuted ? 'Muted' : `${percentage}%`}
        </Text>
      </View>

      <View className="flex-row items-center gap-3">
        {/* Mute Button */}
        <Pressable
          onPress={handleMuteToggle}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
          accessibilityValue={{ text: `${percentage}%` }}
          className={`p-2 rounded-lg ${
            disabled
              ? 'bg-gray-800/50'
              : isMuted
                ? 'bg-red-600/20 active:bg-red-600/30'
                : 'bg-gray-700 active:bg-gray-600'
          }`}
        >
          {isMuted ? (
            <VolumeX size={20} color={disabled ? '#6b7280' : '#ef4444'} />
          ) : (
            <Volume2 size={20} color={disabled ? '#6b7280' : '#9ca3af'} />
          )}
        </Pressable>

        {/* Slider Track */}
        <View
          ref={trackRef}
          className="flex-1 h-10 justify-center"
          onLayout={handleTrackLayout}
          onStartShouldSetResponder={() => !disabled}
          onMoveShouldSetResponder={() => !disabled}
          onResponderGrant={handleTouchStart}
          onResponderMove={handleTouchMove}
          onResponderRelease={handleTouchEnd}
          accessibilityRole="adjustable"
          accessibilityLabel="Volume"
          accessibilityValue={{ text: `${percentage}%` }}
          onAccessibilityAction={handleAccessibilityAction}
        >
          <View className={`h-2 rounded-full ${disabled ? 'bg-gray-800' : 'bg-gray-700'}`}>
            {/* Filled Track */}
            <View
              className={`h-full rounded-full ${
                disabled ? 'bg-gray-600' : isMuted ? 'bg-gray-600' : 'bg-blue-500'
              }`}
              style={{ width: `${percentage}%` }}
            />

            {/* Thumb */}
            <View
              className={`absolute w-5 h-5 rounded-full -top-1.5 ${
                disabled
                  ? 'bg-gray-500'
                  : isMuted
                    ? 'bg-gray-400'
                    : 'bg-white'
              }`}
              style={{
                left: `${percentage}%`,
                marginLeft: -10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3,
                elevation: 3,
              }}
              pointerEvents="none"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
