import { Platform } from 'react-native';
import EventEmitter from 'eventemitter3';
import {
  createConnectedNode,
  cleanupBifrostNode,
  validateShare,
  validateGroup,
  getShareDetailsWithGroup,
  extractPeersFromCredentials,
  pingPeersAdvanced,
  sendEcho,
  setNodePolicies,
  decodeGroup,
  decodeShare,
  normalizePubkey,
} from '@frostr/igloo-core';
import type { BifrostNode } from '@frostr/bifrost';
import type { NodeEventConfig, PingResult as IglooPingResult } from '@frostr/igloo-core';
import type {
  SignerStatus,
  SigningRequest,
  SigningResult,
  ValidationResult,
  ShareDetails,
  PeerStatus,
  PeerPolicy,
  PingResult,
  LogLevel,
  LogCategory,
  LogEntry,
  IglooServiceEvents,
} from '@/types';
import type { StartSignerOptions } from './types';
import { audioService } from '@/services/audio';

// Background audio soundscape is iOS-only because:
// 1. iOS requires audio playback for background execution
// 2. Android uses different background execution mechanisms (foreground services)
const ENABLE_BACKGROUND_AUDIO = Platform.OS === 'ios';

/**
 * IglooService - Core service wrapping @frostr/igloo-core for React Native.
 * Uses EventEmitter to communicate with React components via hooks.
 */
class IglooService extends EventEmitter<IglooServiceEvents> {
  private node: BifrostNode | null = null;
  private groupCredential: string | null = null;
  private shareCredential: string | null = null;
  private currentRelays: string[] = [];
  // Track pending signing requests for correlation with completion events
  private pendingRequests: Map<string, SigningRequest> = new Map();
  // Track registered node event handlers for cleanup
  private nodeEventHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  /**
   * Start the signer node and connect to relays.
   */
  async startSigner(
    groupCredential: string,
    shareCredential: string,
    relays: string[],
    options: StartSignerOptions = {}
  ): Promise<void> {
    // Don't start if already running - restart with audio preserved
    if (this.node) {
      this.log('warn', 'system', 'Signer already running, restarting (keeping audio)...');
      await this.stopSigner({ keepAudio: true });
    }

    this.emit('status:changed', 'connecting');
    this.log('info', 'system', 'Starting signer node...', { relays });

    try {
      const eventConfig: NodeEventConfig = {
        enableLogging: true,
        logLevel: 'debug',
        customLogger: (level, message, data) => {
          this.log(level as LogLevel, 'system', message, data as Record<string, unknown>);
        },
      };

      const { node, state } = await createConnectedNode(
        {
          group: groupCredential,
          share: shareCredential,
          relays,
        },
        eventConfig
      );

      this.node = node;
      this.groupCredential = groupCredential;
      this.shareCredential = shareCredential;
      this.currentRelays = state.connectedRelays;

      // Fail fast if no relays connected
      if (this.currentRelays.length === 0) {
        cleanupBifrostNode(this.node);
        this.node = null;
        this.groupCredential = null;
        this.shareCredential = null;
        this.emit('status:changed', 'error');
        throw new Error('Failed to connect to any relays');
      }

      this.setupNodeEventListeners();

      this.emit('status:changed', 'running');

      // Start background audio to keep app alive in iOS background mode
      if (ENABLE_BACKGROUND_AUDIO) {
        try {
          // Set up callback to receive native audio status changes (interruptions, etc.)
          audioService.setStatusChangeCallback((status) => {
            this.emit('audio:status', status);
            if (status === 'interrupted') {
              this.log('warn', 'system', 'Background audio interrupted (phone call, Siri, etc.)');
            } else if (status === 'error') {
              this.log('warn', 'system', 'Background audio failed to resume');
            } else if (status === 'playing') {
              this.log('info', 'system', 'Background audio resumed');
            }
          });

          await audioService.play();
          this.emit('audio:status', 'playing');

          // Subscribe to native events for interruption handling
          audioService.subscribeToNativeEvents();

          // Start health check as fallback to detect if audio stops unexpectedly
          audioService.startHealthCheck(() => {
            this.emit('audio:status', 'error');
            this.log('warn', 'system', 'Background audio stopped unexpectedly');
          });
        } catch (error) {
          this.emit('audio:status', 'error');
          this.log('warn', 'system', 'Failed to start background audio', {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }

      this.log('info', 'system', 'Signer node started successfully', {
        relayCount: state.connectedRelays.length,
        requestedRelays: relays.length,
      });

      // Emit only for actually connected relays
      state.connectedRelays.forEach((relay) => this.emit('relay:connected', relay));

      // Log warning if some relays failed to connect
      if (state.connectedRelays.length < relays.length) {
        const failedRelays = relays.filter((r) => !state.connectedRelays.includes(r));
        this.log('warn', 'relay', 'Some relays failed to connect', { failedRelays });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('status:changed', 'error');
      this.emit('error', error instanceof Error ? error : new Error(errorMessage));
      this.log('error', 'system', 'Failed to start signer', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Stop the signer node and clean up resources.
   * @param options.keepAudio - If true, don't stop background audio (used during restart)
   */
  async stopSigner(options: { keepAudio?: boolean } = {}): Promise<void> {
    if (!this.node) {
      this.log('debug', 'system', 'No node to stop');
      return;
    }

    this.log('info', 'system', 'Stopping signer node...', { keepAudio: options.keepAudio });

    try {
      // Emit disconnection events for current relays
      this.currentRelays.forEach((relay) => this.emit('relay:disconnected', relay));

      // Clean up node event listeners before destroying the node
      this.cleanupNodeEventListeners();

      cleanupBifrostNode(this.node);

      this.node = null;
      this.groupCredential = null;
      this.shareCredential = null;
      this.currentRelays = [];
      this.pendingRequests.clear();

      this.emit('status:changed', 'stopped');

      // Stop background audio (unless we're restarting)
      if (ENABLE_BACKGROUND_AUDIO && !options.keepAudio) {
        audioService.stopHealthCheck();
        audioService.unsubscribeFromNativeEvents();
        audioService.setStatusChangeCallback(undefined);
        try {
          await audioService.stop();
          this.emit('audio:status', 'idle');
        } catch (audioError) {
          this.log('warn', 'system', 'Failed to stop background audio', {
            error: audioError instanceof Error ? audioError.message : 'Unknown',
          });
        }
      }

      this.log('info', 'system', 'Signer node stopped');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'system', 'Error during node cleanup', { error: errorMessage });
      // Still mark as stopped even if cleanup had issues
      this.emit('status:changed', 'stopped');

      // Also stop audio on error (unless we're restarting)
      if (ENABLE_BACKGROUND_AUDIO && !options.keepAudio) {
        audioService.stopHealthCheck();
        audioService.unsubscribeFromNativeEvents();
        audioService.setStatusChangeCallback(undefined);
        try {
          await audioService.stop();
          this.emit('audio:status', 'idle');
        } catch {
          // Ignore audio stop errors during error handling
        }
      }
    }
  }

  /**
   * Check if signer is currently running.
   */
  isRunning(): boolean {
    return this.node !== null;
  }

  /**
   * Get current connected relays.
   */
  getConnectedRelays(): string[] {
    return [...this.currentRelays];
  }

  /**
   * Validate share and group credentials.
   */
  validateCredentials(share: string, group: string): ValidationResult {
    const shareResult = validateShare(share);
    const groupResult = validateGroup(group);

    return {
      isValid: shareResult.isValid && groupResult.isValid,
      shareValid: shareResult.isValid,
      groupValid: groupResult.isValid,
      shareError: shareResult.isValid ? undefined : shareResult.message,
      groupError: groupResult.isValid ? undefined : groupResult.message,
    };
  }

  /**
   * Validate credentials with actual decoding test.
   * This goes beyond format validation to test if the credentials can be decoded.
   */
  validateCredentialsWithDecode(share: string, group: string): {
    isValid: boolean;
    shareValid: boolean;
    groupValid: boolean;
    canDecode: boolean;
    shareError?: string;
    groupError?: string;
    decodeError?: string;
    peerCount?: number;
    threshold?: number;
    totalMembers?: number;
  } {
    // First do format validation
    const formatResult = this.validateCredentials(share, group);

    if (!formatResult.isValid) {
      return { ...formatResult, canDecode: false };
    }

    // Then test actual decoding
    try {
      const peers = extractPeersFromCredentials(group, share);
      const details = getShareDetailsWithGroup(share, group);

      this.log('info', 'system', 'Credential decode validation passed', {
        peerCount: peers.length,
        threshold: details.threshold,
        totalMembers: details.totalMembers,
        shareIdx: details.idx,
      });

      return {
        ...formatResult,
        canDecode: true,
        peerCount: peers.length,
        threshold: details.threshold,
        totalMembers: details.totalMembers,
      };
    } catch (error) {
      const decodeError =
        error instanceof Error ? error.message : 'Failed to decode credentials';

      this.log('error', 'system', 'Credential decode validation failed', {
        error: decodeError,
      });

      return {
        ...formatResult,
        canDecode: false,
        decodeError,
      };
    }
  }

  /**
   * Get share details including threshold info.
   * Returns null if credentials cannot be decoded.
   */
  getShareDetails(share: string, group: string): ShareDetails | null {
    try {
      // Decode credentials directly instead of relying on getShareDetailsWithGroup
      // because getShareDetailsWithGroup returns undefined for totalMembers
      // (the GroupPackage type doesn't have that field - only commits[])
      const decodedGroup = decodeGroup(group);
      const decodedShare = decodeShare(share);

      // Calculate totalMembers from commits array length (like igloo-web does)
      const totalMembers = decodedGroup.commits?.length ?? 0;

      // Get group pubkey - it's stored as group_pk in the decoded group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const groupPubkey = (decodedGroup as any).group_pk || '';

      this.log('debug', 'system', 'Decoded share details', {
        idx: decodedShare.idx,
        threshold: decodedGroup.threshold,
        totalMembers,
        commitsCount: decodedGroup.commits?.length,
        hasGroupPk: !!groupPubkey,
      });

      return {
        idx: decodedShare.idx,
        threshold: decodedGroup.threshold,
        totalMembers,
        groupPubkey,
      };
    } catch (error) {
      this.log('error', 'system', 'Failed to decode share details', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Extract peer pubkeys from credentials.
   */
  getPeers(groupCredential?: string, shareCredential?: string): string[] {
    const group = groupCredential || this.groupCredential;
    const share = shareCredential || this.shareCredential;

    if (!group || !share) {
      this.log('warn', 'peer', 'Cannot extract peers: missing credentials', {
        hasGroup: !!group,
        hasShare: !!share,
      });
      return [];
    }

    try {
      // Try igloo-core function first
      const peers = extractPeersFromCredentials(group, share).map(normalizePeerPubkey);
      if (peers.length > 0) {
        this.log('debug', 'peer', `Extracted ${peers.length} peers via igloo-core`, {
          peers: peers.map((p) => truncatePubkey(p)),
        });
        return peers;
      }

      // Fallback to manual extraction if igloo-core returns empty
      this.log('debug', 'peer', 'igloo-core returned 0 peers, trying manual extraction');
      return this.extractPeersManually(group, share);
    } catch (error) {
      this.log('warn', 'peer', 'extractPeersFromCredentials failed, trying manual', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      try {
        return this.extractPeersManually(group, share);
      } catch (manualError) {
        this.log('error', 'peer', 'Manual peer extraction also failed', {
          error: manualError instanceof Error ? manualError.message : 'Unknown',
        });
        return [];
      }
    }
  }

  /**
   * Manual peer extraction as fallback when igloo-core returns empty.
   * Extracts peer pubkeys directly from group.commits, excluding self.
   */
  private extractPeersManually(groupCredential: string, shareCredential: string): string[] {
    const decodedGroup = decodeGroup(groupCredential);
    const decodedShare = decodeShare(shareCredential);

    // Find self pubkey by matching share index
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selfCommit = decodedGroup.commits?.find((c: any) => c.idx === decodedShare.idx);
    const selfPubkey = selfCommit?.pubkey ? normalizePeerPubkey(selfCommit.pubkey) : undefined;

    // Extract all peer pubkeys, excluding self
    const peers = (decodedGroup.commits ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((commit: any) => normalizePeerPubkey(commit.pubkey) !== selfPubkey)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((commit: any) => normalizePeerPubkey(commit.pubkey));

    this.log('debug', 'peer', 'Manual peer extraction', {
      totalCommits: decodedGroup.commits?.length,
      selfIdx: decodedShare.idx,
      selfPubkey: selfPubkey ? truncatePubkey(selfPubkey) : 'not found',
      peerCount: peers.length,
    });

    return Array.from(new Set(peers));
  }

  /**
   * Get self pubkey from credentials.
   */
  getSelfPubkey(groupCredential?: string, shareCredential?: string): string | null {
    const group = groupCredential || this.groupCredential;
    const share = shareCredential || this.shareCredential;

    if (!group || !share) {
      return null;
    }

    try {
      const decodedGroup = decodeGroup(group);
      const decodedShare = decodeShare(share);

      // Find our commit by matching share index
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selfCommit = decodedGroup.commits?.find((c: any) => c.idx === decodedShare.idx);
      const pubkey = selfCommit?.pubkey ? normalizePeerPubkey(selfCommit.pubkey) : null;

      this.log('debug', 'peer', 'Extracted self pubkey', {
        shareIdx: decodedShare.idx,
        found: !!pubkey,
      });

      return pubkey;
    } catch (error) {
      this.log('error', 'peer', 'Failed to get self pubkey', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }

  /**
   * Ping all peers and return results.
   */
  async pingAllPeers(timeout = 5000): Promise<PingResult[]> {
    if (!this.node) {
      throw new Error('Signer not running');
    }

    const peers = this.getPeers().map(normalizePeerPubkey);
    if (peers.length === 0) {
      this.log('warn', 'peer', 'No peers to ping');
      return [];
    }

    this.log('info', 'peer', `Pinging ${peers.length} peers...`);

    try {
      const iglooResults = await pingPeersAdvanced(this.node, peers, { timeout });

      // Convert igloo-core PingResult to local PingResult type and emit status updates
      const results: PingResult[] = iglooResults.map((result: IglooPingResult) => {
        const normalizedPubkey = normalizePeerPubkey(result.pubkey);
        const status: PeerStatus = result.success ? 'online' : 'offline';
        this.emit('peer:status', normalizedPubkey, status, result.latency);
        this.log('info', 'peer', `Ping ${truncatePubkey(normalizedPubkey)}`, {
          success: result.success,
          latency: result.latency,
          error: result.error,
        });

        return {
          success: result.success,
          pubkey: normalizedPubkey,
          latency: result.latency,
          policy: result.policy,
          error: result.error,
          timestamp: result.timestamp,
        };
      });

      return results;
    } catch (error) {
      this.log('error', 'peer', 'Ping operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Ping a single peer and return the result.
   */
  async pingSinglePeer(pubkey: string, timeout = 5000): Promise<PingResult> {
    if (!this.node) {
      throw new Error('Signer not running');
    }

    const normalizedPubkey = normalizePeerPubkey(pubkey);
    this.log('info', 'peer', `Pinging peer ${truncatePubkey(normalizedPubkey)}...`);

    try {
      const iglooResults = await pingPeersAdvanced(this.node, [normalizedPubkey], { timeout });

      if (iglooResults.length === 0) {
        const errorResult: PingResult = {
          success: false,
          pubkey: normalizedPubkey,
          error: 'No response',
          timestamp: new Date(),
        };
        this.emit('peer:status', normalizedPubkey, 'offline');
        return errorResult;
      }

      const result = iglooResults[0];
      const resultPubkey = normalizePeerPubkey(result.pubkey);
      const status: PeerStatus = result.success ? 'online' : 'offline';
      this.emit('peer:status', resultPubkey, status, result.latency);

      this.log('info', 'peer', `Ping result ${truncatePubkey(resultPubkey)}`, {
        success: result.success,
        latency: result.latency,
        error: result.error,
      });

      return {
        success: result.success,
        pubkey: resultPubkey,
        latency: result.latency,
        policy: result.policy,
        error: result.error,
        timestamp: result.timestamp,
      };
    } catch (error) {
      this.log('error', 'peer', `Ping failed for ${truncatePubkey(normalizedPubkey)}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send echo signal (used during onboarding).
   */
  async sendEchoSignal(
    challenge: string,
    relays: string[],
    groupCredential?: string,
    shareCredential?: string
  ): Promise<boolean> {
    const group = groupCredential || this.groupCredential;
    const share = shareCredential || this.shareCredential;

    if (!group || !share) {
      throw new Error('Credentials not available');
    }

    this.log('info', 'echo', 'Sending echo signal...', { relays });

    try {
      const result = await sendEcho(group, share, challenge, {
        relays,
        timeout: 10000,
      });

      this.log(result ? 'info' : 'warn', 'echo', `Echo ${result ? 'sent successfully' : 'failed'}`);
      return result;
    } catch (error) {
      this.log('error', 'echo', 'Echo failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update peer policies.
   */
  async updatePeerPolicies(policies: PeerPolicy[]): Promise<void> {
    if (!this.node) {
      throw new Error('Signer not running');
    }

    this.log('info', 'peer', 'Updating peer policies', { count: policies.length });

    try {
      await setNodePolicies(
        this.node,
        policies.map((p) => ({
          pubkey: normalizePeerPubkey(p.pubkey),
          allowSend: p.allowSend,
          allowReceive: p.allowReceive,
          label: p.label,
          note: p.note,
        })),
        { merge: true }
      );

      this.log('info', 'peer', 'Peer policies updated successfully');
    } catch (error) {
      this.log('error', 'peer', 'Failed to update policies', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up previously registered node event listeners.
   */
  private cleanupNodeEventListeners(): void {
    if (!this.node || this.nodeEventHandlers.length === 0) return;

    const node = this.node as unknown as {
      off: (event: string, handler: (...args: unknown[]) => void) => void;
    };

    for (const { event, handler } of this.nodeEventHandlers) {
      node.off(event, handler);
    }
    this.nodeEventHandlers = [];
  }

  /**
   * Set up event listeners on the BifrostNode.
   */
  private setupNodeEventListeners(): void {
    if (!this.node) return;

    // Clean up any existing handlers first to prevent duplicates
    this.cleanupNodeEventListeners();

    // Cast node to any for event registration since BifrostNode types
    // don't include all the internal event names
    const node = this.node as unknown as {
      on: (event: string, handler: (...args: unknown[]) => void) => void;
    };

    // Helper to register and track handlers
    const registerHandler = (event: string, handler: (...args: unknown[]) => void) => {
      node.on(event, handler);
      this.nodeEventHandlers.push({ event, handler });
    };

    // Signing request received
    const handleSigningRequest = (data: unknown) => {
      const request: SigningRequest = {
        id: generateRequestId(),
        pubkey: (data as { pubkey?: string })?.pubkey || 'unknown',
        timestamp: new Date(),
        eventKind: (data as { kind?: number })?.kind,
        status: 'pending',
      };

      // Track pending request for correlation with completion
      this.pendingRequests.set(request.id, request);

      this.log('info', 'signing', 'Received signing request', {
        id: request.id,
        pubkey: truncatePubkey(request.pubkey),
        kind: request.eventKind,
      });

      this.emit('signing:request', request);
    };
    registerHandler('/sig/handler/req', handleSigningRequest);

    // Signing completed
    const handleSigningComplete = (data: unknown) => {
      // Try to correlate with pending request
      const matchedRequest = this.findAndRemovePendingRequest(data);
      const result: SigningResult = {
        requestId: matchedRequest?.id || 'unknown',
        success: true,
      };

      this.log('info', 'signing', 'Signing request completed', {
        requestId: result.requestId,
        ...(data as Record<string, unknown>),
      });
      this.emit('signing:complete', result);
    };
    registerHandler('/sig/handler/ret', handleSigningComplete);

    // Signing error
    const handleSigningError = (error: unknown) => {
      // Try to correlate with pending request
      const matchedRequest = this.findAndRemovePendingRequest(error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log('error', 'signing', 'Signing error', {
        requestId: matchedRequest?.id,
        error: errorObj.message,
      });
      this.emit('signing:error', errorObj, matchedRequest?.id);
    };
    registerHandler('/sig/handler/err', handleSigningError);

    // Node error
    const handleNodeError = (error: unknown) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log('error', 'system', 'Node error', { error: errorObj.message });
      this.emit('error', errorObj);
    };
    registerHandler('error', handleNodeError);

    // Node closed
    const handleNodeClosed = () => {
      this.log('warn', 'system', 'Node connection closed');
      this.emit('status:changed', 'stopped');
    };
    registerHandler('closed', handleNodeClosed);

    // Debug/info messages
    const handleDebug = (message: unknown) => {
      this.log('debug', 'system', String(message));
    };
    registerHandler('debug', handleDebug);

    const handleInfo = (message: unknown) => {
      this.log('info', 'system', String(message));
    };
    registerHandler('info', handleInfo);
  }

  /**
   * Remove stale pending requests that have exceeded the max age.
   * Prevents unbounded growth of pendingRequests Map when correlation fails.
   */
  private cleanupStaleRequests(maxAgeMs = 30000): void {
    const now = Date.now();
    for (const [id, request] of this.pendingRequests) {
      const age = now - request.timestamp.getTime();
      if (age > maxAgeMs) {
        this.pendingRequests.delete(id);
        this.log('warn', 'signing', 'Evicted stale pending request', {
          id,
          pubkey: truncatePubkey(request.pubkey),
          ageMs: age,
        });
      }
    }
  }

  /**
   * Find and remove a pending request that matches the completion/error data.
   * Tries to match by pubkey if available. Falls back to FIFO only when there's
   * exactly one pending request (unambiguous). Returns undefined if correlation
   * is ambiguous to avoid mis-matching requests.
   */
  private findAndRemovePendingRequest(data: unknown): SigningRequest | undefined {
    // Clean up stale requests first to prevent memory leaks
    this.cleanupStaleRequests();

    if (this.pendingRequests.size === 0) {
      return undefined;
    }

    // Try to extract pubkey from the event data for matching
    const eventPubkey = (data as { pubkey?: string })?.pubkey;

    if (eventPubkey) {
      // Find a pending request with matching pubkey
      for (const [id, request] of this.pendingRequests) {
        if (request.pubkey === eventPubkey) {
          this.pendingRequests.delete(id);
          return request;
        }
      }
    }

    // Only use FIFO when there's exactly one pending request (unambiguous)
    if (this.pendingRequests.size === 1) {
      const oldestEntry = this.pendingRequests.entries().next().value;
      if (oldestEntry) {
        const [id, request] = oldestEntry;
        this.pendingRequests.delete(id);
        return request;
      }
    }

    // Multiple pending requests without pubkey match - cannot correlate safely
    if (this.pendingRequests.size > 1) {
      this.log('warn', 'signing', 'Cannot correlate signing event - no pubkey match and multiple pending requests', {
        pendingCount: this.pendingRequests.size,
        hasEventPubkey: !!eventPubkey,
      });
    }

    return undefined;
  }

  /**
   * Decode a group credential to get its raw data.
   * Returns the decoded group object or null on error.
   */
  decodeGroupCredential(group: string): object | null {
    try {
      return decodeGroup(group);
    } catch (error) {
      this.log('error', 'system', 'Failed to decode group credential', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Decode a share credential to get its raw data.
   * Returns the decoded share object or null on error.
   */
  decodeShareCredential(share: string): object | null {
    try {
      return decodeShare(share);
    } catch (error) {
      this.log('error', 'system', 'Failed to decode share credential', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get the currently loaded credentials (if signer has started).
   */
  getLoadedCredentials(): { group: string | null; share: string | null } {
    return {
      group: this.groupCredential,
      share: this.shareCredential,
    };
  }

  /**
   * Internal logging helper that emits to event listeners.
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: Omit<LogEntry, 'id' | 'timestamp'> = {
      level,
      category,
      message,
      data,
    };
    this.emit('log', entry);
  }
}

// Helper functions
function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

function normalizePeerPubkey(pubkey: string): string {
  if (!pubkey) return pubkey;
  return normalizePubkey(pubkey).toLowerCase();
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Export singleton instance
export const iglooService = new IglooService();

// Export class for testing
export { IglooService };
