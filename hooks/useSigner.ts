import { useCallback } from 'react';
import { useSignerStore, useRelayStore, useCredentialStore } from '@/stores';
import { secureStorage } from '@/services/storage/secureStorage';
import { useIgloo } from './useIgloo';

/**
 * Hook for signer state and control.
 */
export function useSigner() {
  const { startSigner, stopSigner, isRunning } = useIgloo();

  // Signer state
  const status = useSignerStore((s) => s.status);
  const connectedRelays = useSignerStore((s) => s.connectedRelays);
  const lastError = useSignerStore((s) => s.lastError);
  const signingRequestsReceived = useSignerStore((s) => s.signingRequestsReceived);
  const signingRequestsCompleted = useSignerStore((s) => s.signingRequestsCompleted);
  const sessionStartTime = useSignerStore((s) => s.sessionStartTime);
  const recentRequests = useSignerStore((s) => s.recentRequests);
  const resetSession = useSignerStore((s) => s.resetSession);

  // Related stores
  const relays = useRelayStore((s) => s.relays);
  const shareDetails = useCredentialStore((s) => s.shareDetails);

  /**
   * Start the signer with stored credentials and configured relays.
   */
  const start = useCallback(async () => {
    const credentials = await secureStorage.getCredentials();
    if (!credentials) {
      throw new Error('No credentials found');
    }

    await startSigner(credentials.group, credentials.share, relays);
  }, [startSigner, relays]);

  /**
   * Stop the signer.
   */
  const stop = useCallback(async () => {
    await stopSigner();
  }, [stopSigner]);

  /**
   * Toggle signer on/off.
   */
  const toggle = useCallback(async () => {
    if (isRunning()) {
      await stop();
    } else {
      await start();
    }
  }, [start, stop, isRunning]);

  /**
   * Calculate uptime in seconds.
   */
  const getUptime = useCallback((): number => {
    if (!sessionStartTime) return 0;
    return Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
  }, [sessionStartTime]);

  return {
    // State
    status,
    connectedRelays,
    lastError,
    signingRequestsReceived,
    signingRequestsCompleted,
    sessionStartTime,
    recentRequests,
    shareDetails,

    // Computed
    isRunning: status === 'running',
    isConnecting: status === 'connecting',
    isStopped: status === 'stopped',
    hasError: status === 'error',

    // Actions
    start,
    stop,
    toggle,
    resetSession,
    getUptime,
  };
}
