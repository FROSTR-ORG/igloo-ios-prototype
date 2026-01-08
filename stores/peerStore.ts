import type { Peer, PeerStatus, PeerStoreState } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const usePeerStore = create<PeerStoreState>()(
  persist(
    (set, get) => ({
      // State
      peers: {},
      selfPubkey: null,
      lastPingTime: null,

      // Actions
      setPeers: (peers: Peer[]) => {
        const peersRecord: Record<string, Peer> = {};
        for (const peer of peers) {
          // Preserve existing policies if peer already exists
          const existing = get().peers[peer.pubkey];
          peersRecord[peer.pubkey] = {
            ...peer,
            allowSend: existing?.allowSend ?? peer.allowSend,
            allowReceive: existing?.allowReceive ?? peer.allowReceive,
          };
        }
        set({ peers: peersRecord });
      },

      updatePeer: (pubkey: string, update: Partial<Peer>) => {
        set((state) => ({
          peers: {
            ...state.peers,
            [pubkey]: state.peers[pubkey]
              ? { ...state.peers[pubkey], ...update }
              : {
                  pubkey,
                  status: 'unknown',
                  lastSeen: null,
                  latency: null,
                  allowSend: true,
                  allowReceive: true,
                  ...update
                },
          },
        }));
      },

      updatePeerStatus: (pubkey: string, status: PeerStatus, latency?: number) => {
        set((state) => ({
          peers: {
            ...state.peers,
            [pubkey]: state.peers[pubkey]
              ? {
                  ...state.peers[pubkey],
                  status,
                  latency: latency ?? state.peers[pubkey].latency,
                  lastSeen: status === 'online' ? new Date().toISOString() : state.peers[pubkey].lastSeen,
                }
              : {
                  pubkey,
                  status,
                  lastSeen: status === 'online' ? new Date().toISOString() : null,
                  latency: latency ?? null,
                  allowSend: true,
                  allowReceive: true,
                },
          },
        }));
      },

      updatePeerPolicy: (
        pubkey: string,
        policy: { allowSend?: boolean; allowReceive?: boolean }
      ) => {
        set((state) => ({
          peers: {
            ...state.peers,
            [pubkey]: state.peers[pubkey]
              ? { ...state.peers[pubkey], ...policy }
              : {
                  pubkey,
                  status: 'unknown',
                  lastSeen: null,
                  latency: null,
                  allowSend: policy.allowSend ?? true,
                  allowReceive: policy.allowReceive ?? true,
                },
          },
        }));
      },

      setSelfPubkey: (pubkey: string) => {
        set({ selfPubkey: pubkey });
      },

      setLastPingTime: (time: Date) => {
        set({ lastPingTime: time });
      },

      clearPeers: () => {
        set({ peers: {}, selfPubkey: null, lastPingTime: null });
      },
    }),
    {
      name: 'igloo-peers',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist policies, not ephemeral status
      partialize: (state) => ({
        peers: Object.fromEntries(
          Object.entries(state.peers).map(([pubkey, peer]) => [
            pubkey,
            {
              pubkey: peer.pubkey,
              displayName: peer.displayName,
              allowSend: peer.allowSend,
              allowReceive: peer.allowReceive,
              // Don't persist ephemeral state
              status: 'unknown' as const,
              lastSeen: null,
              latency: null,
            },
          ])
        ),
        selfPubkey: state.selfPubkey,
      }),
    }
  )
);
