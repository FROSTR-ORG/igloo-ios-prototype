import { Badge, Button, Card, Switch } from '@/components/ui';
import { usePeers, useSigner } from '@/hooks';
import type { Peer } from '@/types';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PeersTab() {
  const { isRunning } = useSigner();
  const {
    peers,
    selfPubkey,
    lastPingTime,
    onlineCount,
    totalCount,
    pingPeers,
    setPeerPolicy,
    loadPeers,
  } = usePeers();

  const [isPinging, setIsPinging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handlePingAll = useCallback(async () => {
    if (!isRunning) {
      Alert.alert('Signer Not Running', 'Start the signer to ping peers.');
      return;
    }

    setIsPinging(true);
    try {
      await pingPeers(5000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Ping Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsPinging(false);
    }
  }, [isRunning, pingPeers]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPeers();
    } catch {
      // Optionally log or show error
    } finally {
      setRefreshing(false);
    }
  }, [loadPeers]);

  const handleCopyPubkey = useCallback(async (pubkey: string) => {
    await Clipboard.setStringAsync(pubkey);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header Stats */}
        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-gray-500 dark:text-gray-400">Peers in Group</Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalCount}
                </Text>
                {isRunning && (
                  <Badge
                    label={`${onlineCount} online`}
                    variant={onlineCount > 0 ? 'success' : 'default'}
                    size="sm"
                    dot
                    className="ml-2"
                  />
                )}
              </View>
            </View>
            <Button
              title={isPinging ? 'Pinging...' : 'Ping All'}
              variant="secondary"
              size="sm"
              loading={isPinging}
              disabled={!isRunning}
              icon={<FontAwesome name="wifi" size={14} color="#374151" />}
              onPress={handlePingAll}
            />
          </View>
          {lastPingTime && (
            <Text className="text-xs text-gray-400 mt-2">
              Last ping: {lastPingTime.toLocaleTimeString()}
            </Text>
          )}
        </Card>

        {/* Self Info */}
        {selfPubkey && (
          <Card className="mb-4 bg-frost-50 dark:bg-frost-900/20">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-frost-200 dark:bg-frost-800 rounded-full items-center justify-center mr-3">
                <FontAwesome name="user" size={18} color="#0284c7" />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-frost-600 dark:text-frost-400 mb-0.5">
                  Your Share
                </Text>
                <Pressable onPress={() => handleCopyPubkey(selfPubkey)}>
                  <Text className="text-sm font-mono text-frost-800 dark:text-frost-200">
                    {truncatePubkey(selfPubkey)}
                  </Text>
                </Pressable>
              </View>
              <FontAwesome name="check-circle" size={20} color="#0284c7" />
            </View>
          </Card>
        )}

        {/* Peer List */}
        <View className="mb-2">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Other Peers
          </Text>
        </View>

        {peers.length === 0 ? (
          <Card>
            <View className="py-8 items-center">
              <FontAwesome name="users" size={32} color="#9ca3af" />
              <Text className="text-gray-500 dark:text-gray-400 mt-2">
                No peers found
              </Text>
              <Text className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Add credentials to see your signing group
              </Text>
            </View>
          </Card>
        ) : (
          <View className="space-y-3">
            {peers.map((peer) => (
              <PeerCard
                key={peer.pubkey}
                peer={peer}
                isSignerRunning={isRunning}
                onCopyPubkey={handleCopyPubkey}
                onUpdatePolicy={(policy) => setPeerPolicy(peer.pubkey, policy)}
              />
            ))}
          </View>
        )}

        {/* Info Card */}
        {!isRunning && peers.length > 0 && (
          <Card className="mt-4 bg-yellow-50 dark:bg-yellow-900/20">
            <View className="flex-row items-start">
              <FontAwesome name="info-circle" size={16} color="#ca8a04" />
              <Text className="flex-1 ml-2 text-sm text-yellow-700 dark:text-yellow-400">
                Start the signer to ping peers and update their status in real-time.
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PeerCard({
  peer,
  isSignerRunning,
  onCopyPubkey,
  onUpdatePolicy,
}: {
  peer: Peer;
  isSignerRunning: boolean;
  onCopyPubkey: (pubkey: string) => void;
  onUpdatePolicy: (policy: { allowSend?: boolean; allowReceive?: boolean }) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = () => {
    if (!isSignerRunning) return null;

    switch (peer.status) {
      case 'online':
        return <Badge label="Online" variant="success" size="sm" dot />;
      case 'offline':
        return <Badge label="Offline" variant="error" size="sm" dot />;
      default:
        return <Badge label="Unknown" variant="default" size="sm" />;
    }
  };

  return (
    <Card padding="none">
      {/* Main Row */}
      <Pressable
        className="flex-row items-center p-4"
        onPress={() => setExpanded(!expanded)}
      >
        <View
          className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
            peer.status === 'online'
              ? 'bg-green-100 dark:bg-green-900/30'
              : peer.status === 'offline'
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          <FontAwesome
            name="user"
            size={18}
            color={
              peer.status === 'online'
                ? '#22c55e'
                : peer.status === 'offline'
                  ? '#ef4444'
                  : '#9ca3af'
            }
          />
        </View>
        <View className="flex-1">
          <Pressable onPress={() => onCopyPubkey(peer.pubkey)}>
            <Text className="text-sm font-mono text-gray-900 dark:text-white">
              {truncatePubkey(peer.pubkey)}
            </Text>
          </Pressable>
          <View className="flex-row items-center mt-1">
            {getStatusBadge()}
            {peer.latency !== null && peer.status === 'online' && (
              <Text className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                {peer.latency}ms
              </Text>
            )}
            {peer.lastSeen && (
              <Text className="text-xs text-gray-400 ml-2">
                {formatLastSeen(peer.lastSeen)}
              </Text>
            )}
          </View>
        </View>
        <FontAwesome
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="#9ca3af"
        />
      </Pressable>

      {/* Expanded Section - Policies */}
      {expanded && (
        <View className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
            Policy Settings
          </Text>
          <View className="space-y-3">
            <Switch
              label="Allow Send"
              description="Allow sending signing requests to this peer"
              value={peer.allowSend}
              onValueChange={(value) => onUpdatePolicy({ allowSend: value })}
            />
            <Switch
              label="Allow Receive"
              description="Accept signing requests from this peer"
              value={peer.allowReceive}
              onValueChange={(value) => onUpdatePolicy({ allowReceive: value })}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

function formatLastSeen(lastSeen: string): string {
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}
