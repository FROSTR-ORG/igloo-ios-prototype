import { Button, Card, Input } from '@/components/ui';
import { useCredentials, useSigner } from '@/hooks';
import { useRelayStore } from '@/stores';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import pkg from '../../package.json';

const IGLOO_CORE_VERSION = pkg.dependencies['@frostr/igloo-core']?.replace(/^[\^~]/, '') ?? 'unknown';

export default function SettingsTab() {
  const { stop } = useSigner();
  const { shareDetails, deleteCredentials } = useCredentials();
  const relays = useRelayStore((s) => s.relays);
  const addRelay = useRelayStore((s) => s.addRelay);
  const removeRelay = useRelayStore((s) => s.removeRelay);
  const resetToDefaults = useRelayStore((s) => s.resetToDefaults);

  const [newRelay, setNewRelay] = useState('');
  const [relayError, setRelayError] = useState<string>();

  const handleAddRelay = useCallback(() => {
    if (!newRelay.trim()) {
      setRelayError('Enter a relay URL');
      return;
    }

    // Validate WebSocket URL using regex (URL constructor not available in React Native)
    const url = newRelay.trim();
    const wsUrlPattern = /^(ws|wss):\/\/([^\s/]+)(\/.*)?$/;
    const match = url.match(wsUrlPattern);
    
    if (!match) {
      setRelayError('URL must start with ws:// or wss://');
      return;
    }
    
    const host = match[2];
    if (!host || host.length === 0) {
      setRelayError('Invalid relay URL');
      return;
    }

    addRelay(newRelay.trim());
    setNewRelay('');
    setRelayError(undefined);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [newRelay, addRelay]);

  const handleRemoveRelay = useCallback(
    (relay: string) => {
      Alert.alert('Remove Relay', `Remove ${relay}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeRelay(relay);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ]);
    },
    [removeRelay]
  );

  const handleResetRelays = useCallback(() => {
    Alert.alert('Reset Relays', 'Reset to default relay list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () => {
          resetToDefaults();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }, [resetToDefaults]);

  const handleClearCredentials = useCallback(async () => {
    Alert.alert(
      'Clear Credentials',
      'This will delete your stored credentials and return you to onboarding. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await stop();
              await deleteCredentials();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/onboarding');
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to clear credentials'
              );
            }
          },
        },
      ]
    );
  }, [stop, deleteCredentials]);

  const handleCopyGroupPubkey = useCallback(async () => {
    if (shareDetails?.groupPubkey) {
      await Clipboard.setStringAsync(shareDetails.groupPubkey);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [shareDetails]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* Relay Configuration */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Relay Configuration
          </Text>

          <Card className="mb-3">
            {/* Current Relays */}
            {relays.map((relay, index) => (
              <View
                key={relay}
                className={`flex-row items-center justify-between py-3 ${
                  index > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
                }`}
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <FontAwesome name="server" size={14} color="#6b7280" />
                  <Text
                    className="text-sm text-gray-900 dark:text-white ml-2 flex-1"
                    numberOfLines={1}
                  >
                    {relay}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleRemoveRelay(relay)}
                  className="p-2"
                  hitSlop={8}
                >
                  <FontAwesome name="times" size={16} color="#ef4444" />
                </Pressable>
              </View>
            ))}

            {relays.length === 0 && (
              <Text className="text-gray-500 dark:text-gray-400 py-4 text-center">
                No relays configured
              </Text>
            )}
          </Card>

          {/* Add Relay */}
          <Card>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add Relay
            </Text>
            <View className="flex-row items-start">
              <Input
                className="flex-1 mr-2"
                placeholder="wss://relay.example.com"
                value={newRelay}
                onChangeText={(text) => {
                  setNewRelay(text);
                  setRelayError(undefined);
                }}
                error={relayError}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Button title="Add" size="md" onPress={handleAddRelay} />
            </View>
          </Card>

          {/* Reset Button */}
          <Pressable onPress={handleResetRelays} className="mt-3 py-2">
            <Text className="text-frost-600 dark:text-frost-400 text-center text-sm">
              Reset to Default Relays
            </Text>
          </Pressable>
        </View>

        {/* Credential Info */}
        {shareDetails && (
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Credential Information
            </Text>

            <Card>
              <InfoRow label="Share Index" value={`#${shareDetails.idx}`} />
              <InfoRow
                label="Threshold"
                value={`${shareDetails.threshold}-of-${shareDetails.totalMembers}`}
                isLast={!shareDetails.groupPubkey}
              />
              {shareDetails.groupPubkey && (
                <Pressable onPress={handleCopyGroupPubkey}>
                  <InfoRow
                    label="Group Pubkey"
                    value={truncatePubkey(shareDetails.groupPubkey)}
                    copyable
                    isLast
                  />
                </Pressable>
              )}
            </Card>
          </View>
        )}

        {/* App Info */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            About
          </Text>

          <Card>
            <InfoRow label="App Version" value={pkg.version} />
            <InfoRow label="igloo-core" value={IGLOO_CORE_VERSION} isLast />
          </Card>
        </View>

        {/* Danger Zone */}
        <View>
          <Text className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">
            Danger Zone
          </Text>

          <Card className="border-red-200 dark:border-red-900">
            <Text className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Clearing your credentials will remove all stored data and return you to the
              onboarding screen. Make sure you have a backup of your credentials.
            </Text>
            <Button
              title="Clear All Credentials"
              variant="danger"
              onPress={handleClearCredentials}
            />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  copyable = false,
  isLast = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-2 ${
        isLast ? '' : 'border-b border-gray-100 dark:border-gray-700'
      }`}
    >
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <View className="flex-row items-center">
        <Text className="text-sm font-medium text-gray-900 dark:text-white">{value}</Text>
        {copyable && (
          <FontAwesome name="copy" size={12} color="#9ca3af" style={{ marginLeft: 6 }} />
        )}
      </View>
    </View>
  );
}

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}
