import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Button, Card, Badge } from '@/components/ui';
import { useSigner } from '@/hooks';
import type { SignerStatus } from '@/types';

export default function SignerTab() {
  const {
    status,
    connectedRelays,
    lastError,
    signingRequestsReceived,
    signingRequestsCompleted,
    recentRequests,
    shareDetails,
    isRunning,
    isConnecting,
    start,
    stop,
    getUptime,
  } = useSigner();

  const [uptime, setUptime] = useState(0);

  // Update uptime every second when running
  useEffect(() => {
    if (!isRunning) {
      setUptime(0);
      return;
    }

    const interval = setInterval(() => {
      setUptime(getUptime());
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, getUptime]);

  const handleToggle = useCallback(async () => {
    try {
      if (isRunning) {
        await stop();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to toggle signer'
      );
    }
  }, [isRunning, start, stop]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* Status Card */}
        <Card variant="elevated" className="mb-4">
          <View className="items-center py-4">
            <StatusIndicator status={status} />
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mt-4">
              {getStatusText(status)}
            </Text>
            {lastError && (
              <Text className="text-sm text-red-500 mt-2 text-center">
                {lastError}
              </Text>
            )}
          </View>

          {/* Toggle Button */}
          <Button
            title={isRunning ? 'Stop Signer' : isConnecting ? 'Connecting...' : 'Start Signer'}
            variant={isRunning ? 'danger' : 'primary'}
            size="lg"
            loading={isConnecting}
            onPress={handleToggle}
            className="mt-4"
          />
        </Card>

        {/* Share Info Card */}
        {shareDetails && (
          <Card className="mb-4">
            <View className="flex-row items-center mb-3">
              <FontAwesome name="key" size={16} color="#6b7280" />
              <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-2">
                Share Information
              </Text>
            </View>
            <View className="flex-row justify-between">
              <InfoItem label="Share Index" value={`#${shareDetails.idx}`} />
              <InfoItem
                label="Threshold"
                value={`${shareDetails.threshold}-of-${shareDetails.totalMembers}`}
              />
            </View>
          </Card>
        )}

        {/* Stats Card */}
        <Card className="mb-4">
          <View className="flex-row items-center mb-3">
            <FontAwesome name="bar-chart" size={16} color="#6b7280" />
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-2">
              Session Statistics
            </Text>
          </View>
          <View className="flex-row justify-between">
            <InfoItem
              label="Uptime"
              value={isRunning ? formatUptime(uptime) : '-'}
            />
            <InfoItem
              label="Requests"
              value={`${signingRequestsCompleted}/${signingRequestsReceived}`}
            />
            <InfoItem
              label="Relays"
              value={isRunning ? String(connectedRelays.length) : '-'}
            />
          </View>
        </Card>

        {/* Recent Activity */}
        <Card>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <FontAwesome name="history" size={16} color="#6b7280" />
              <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-2">
                Recent Activity
              </Text>
            </View>
            {recentRequests.length > 0 && (
              <Badge label={String(recentRequests.length)} size="sm" variant="info" />
            )}
          </View>

          {recentRequests.length === 0 ? (
            <View className="py-8 items-center">
              <FontAwesome name="inbox" size={32} color="#9ca3af" />
              <Text className="text-gray-500 dark:text-gray-400 mt-2">
                {isRunning ? 'Waiting for requests...' : 'Start signer to receive requests'}
              </Text>
            </View>
          ) : (
            <View className="space-y-2">
              {recentRequests.slice(0, 5).map((request, index, arr) => (
                <View
                  key={request.id}
                  className={`flex-row items-center justify-between py-2 ${
                    index === arr.length - 1
                      ? ''
                      : 'border-b border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-sm text-gray-900 dark:text-white">
                      {truncatePubkey(request.pubkey)}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(request.timestamp)}
                    </Text>
                  </View>
                  <Badge
                    label={request.status}
                    variant={
                      request.status === 'completed'
                        ? 'success'
                        : request.status === 'failed'
                          ? 'error'
                          : 'warning'
                    }
                    size="sm"
                  />
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusIndicator({ status }: { status: SignerStatus }) {
  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusIcon = (): React.ComponentProps<typeof FontAwesome>['name'] => {
    switch (status) {
      case 'running':
        return 'check-circle';
      case 'connecting':
        return 'spinner';
      case 'error':
        return 'exclamation-circle';
      default:
        return 'power-off';
    }
  };

  return (
    <View className={`w-20 h-20 rounded-full items-center justify-center ${getStatusColor()}`}>
      <FontAwesome name={getStatusIcon()} size={36} color="white" />
    </View>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</Text>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">{value}</Text>
    </View>
  );
}

function getStatusText(status: SignerStatus): string {
  switch (status) {
    case 'running':
      return 'Signer Active';
    case 'connecting':
      return 'Connecting...';
    case 'error':
      return 'Error';
    default:
      return 'Signer Stopped';
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
