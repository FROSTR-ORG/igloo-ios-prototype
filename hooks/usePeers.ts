import { useCallback, useEffect } from 'react';
import { usePeerStore, useCredentialStore } from '@/stores';
import { secureStorage } from '@/services/storage/secureStorage';
import { useIgloo } from './useIgloo';
import type { Peer, PeerPolicy } from '@/types';

/**
 * Hook for peer management and monitoring.
 */
export function usePeers() {
  const { getPeers, getSelfPubkey, pingAllPeers, updatePolicies, isRunning } = useIgloo();

  // Peer state
  const peersRecord = usePeerStore((s) => s.peers);
  const selfPubkey = usePeerStore((s) => s.selfPubkey);
  const lastPingTime = usePeerStore((s) => s.lastPingTime);
  const setPeers = usePeerStore((s) => s.setPeers);
  const setSelfPubkey = usePeerStore((s) => s.setSelfPubkey);
  const setLastPingTime = usePeerStore((s) => s.setLastPingTime);
  const updatePeerPolicy = usePeerStore((s) => s.updatePeerPolicy);
  const clearPeers = usePeerStore((s) => s.clearPeers);

  // Credential state
  const hasCredentials = useCredentialStore((s) => s.hasCredentials);

  /**
   * Convert peers record to array.
   */
  const peers = Object.values(peersRecord);

  /**
   * Get online peers count.
   */
  const onlineCount = peers.filter((p) => p.status === 'online').length;

  /**
   * Load peers from credentials.
   */
  const loadPeers = useCallback(async () => {
    const credentials = await secureStorage.getCredentials();
    if (!credentials) {
      console.warn('[usePeers] No credentials found in secure storage');
      return;
    }

    try {
      const peerPubkeys = getPeers(credentials.group, credentials.share);
      const self = getSelfPubkey(credentials.group, credentials.share);

      if (self) {
        setSelfPubkey(self);
      } else {
        console.warn('[usePeers] Could not extract self pubkey from credentials');
      }

      if (peerPubkeys.length === 0) {
        console.warn('[usePeers] No peers extracted from credentials - this may indicate invalid credentials');
      } else {
        console.log(`[usePeers] Extracted ${peerPubkeys.length} peers`);
      }

      // Create peer objects with default values
      const peerObjects: Peer[] = peerPubkeys.map((pubkey) => ({
        pubkey,
        status: 'unknown',
        lastSeen: null,
        latency: null,
        allowSend: true,
        allowReceive: true,
      }));

      setPeers(peerObjects);
    } catch (error) {
      console.error('[usePeers] Failed to load peers:', error);
      // Still clear peers to avoid stale data
      setPeers([]);
    }
  }, [getPeers, getSelfPubkey, setSelfPubkey, setPeers]);

  /**
   * Ping all peers and update their status.
   */
  const pingPeers = useCallback(
    async (timeout?: number) => {
      if (!isRunning()) {
        throw new Error('Signer must be running to ping peers');
      }

      const results = await pingAllPeers(timeout);
      setLastPingTime(new Date());

      return results;
    },
    [isRunning, pingAllPeers, setLastPingTime]
  );

  /**
   * Update policy for a specific peer.
   */
  const setPeerPolicy = useCallback(
    async (pubkey: string, policy: { allowSend?: boolean; allowReceive?: boolean }) => {
      // Update local state
      updatePeerPolicy(pubkey, policy);

      // If signer is running, also update on the node
      if (isRunning()) {
        const peer = peersRecord[pubkey];
        if (peer) {
          const updatedPolicy: PeerPolicy = {
            pubkey,
            allowSend: policy.allowSend ?? peer.allowSend,
            allowReceive: policy.allowReceive ?? peer.allowReceive,
          };
          await updatePolicies([updatedPolicy]);
        }
      }
    },
    [updatePeerPolicy, peersRecord, isRunning, updatePolicies]
  );

  /**
   * Sync all local policies to the node.
   */
  const syncPoliciesToNode = useCallback(async () => {
    if (!isRunning()) return;

    const policies: PeerPolicy[] = peers.map((peer) => ({
      pubkey: peer.pubkey,
      allowSend: peer.allowSend,
      allowReceive: peer.allowReceive,
    }));

    await updatePolicies(policies);
  }, [isRunning, peers, updatePolicies]);

  // Load peers when credentials become available
  useEffect(() => {
    if (hasCredentials) {
      loadPeers();
    }
  }, [hasCredentials, loadPeers]);

  return {
    // State
    peers,
    selfPubkey,
    lastPingTime,
    onlineCount,
    totalCount: peers.length,

    // Computed
    hasOnlinePeers: onlineCount > 0,

    // Actions
    loadPeers,
    pingPeers,
    setPeerPolicy,
    syncPoliciesToNode,
    clearPeers,
  };
}
