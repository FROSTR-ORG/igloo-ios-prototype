// Type definitions for Igloo mobile signer

// ============================================
// Credential Types
// ============================================

export interface ShareDetails {
  idx: number;
  threshold: number;
  totalMembers: number;
  groupPubkey: string;
}

export interface Credentials {
  share: string; // bfshare credential
  group: string; // bfgroup credential
}

export interface ValidationResult {
  isValid: boolean;
  shareValid: boolean;
  groupValid: boolean;
  shareError?: string;
  groupError?: string;
}

// ============================================
// Signer Types
// ============================================

export type SignerStatus = 'stopped' | 'connecting' | 'running' | 'error';

export interface SigningRequest {
  id: string;
  pubkey: string;
  timestamp: Date;
  eventKind?: number;
  status: 'pending' | 'completed' | 'failed';
}

export interface SigningResult {
  requestId: string;
  success: boolean;
  error?: string;
}

// ============================================
// Peer Types
// ============================================

export type PeerStatus = 'online' | 'offline' | 'unknown';

export interface Peer {
  pubkey: string;
  displayName?: string;
  status: PeerStatus;
  lastSeen: string | null;
  latency: number | null;
  allowSend: boolean;
  allowReceive: boolean;
}

export interface PeerPolicy {
  pubkey: string;
  allowSend: boolean;
  allowReceive: boolean;
  label?: string;
  note?: string;
}

export interface PingResult {
  success: boolean;
  pubkey: string;
  latency?: number;
  policy?: { send: boolean; recv: boolean };
  error?: string;
  timestamp: Date;
}

// ============================================
// Relay Types
// ============================================

export interface RelayConfig {
  url: string;
  enabled: boolean;
}

export const DEFAULT_RELAYS = [
  'wss://relay.primal.net',
] as const;

// ============================================
// Log Types
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'signing' | 'relay' | 'peer' | 'echo' | 'system';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO 8601 timestamp string (serializable)
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, unknown>;
}

export interface LogFilter {
  levels: LogLevel[];
  categories: LogCategory[];
}

// ============================================
// Store Types
// ============================================

export interface CredentialStoreState {
  hasCredentials: boolean;
  shareDetails: ShareDetails | null;
  onboardingComplete: boolean;
  echoSent: boolean;
  isHydrated: boolean;
  // Actions
  hydrateFromStorage: () => Promise<void>;
  setCredentialsExist: (exists: boolean) => void;
  setShareDetails: (details: ShareDetails | null) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setEchoSent: (sent: boolean) => void;
  clearCredentials: () => Promise<void>;
}

export interface SignerStoreState {
  status: SignerStatus;
  connectedRelays: string[];
  lastError: string | null;
  signingRequestsReceived: number;
  signingRequestsCompleted: number;
  sessionStartTime: Date | null;
  recentRequests: SigningRequest[];
  // Actions
  setStatus: (status: SignerStatus) => void;
  setConnectedRelays: (relays: string[]) => void;
  setError: (error: string | null) => void;
  incrementRequestsReceived: () => void;
  incrementRequestsCompleted: () => void;
  addSigningRequest: (request: SigningRequest) => void;
  updateSigningRequest: (id: string, update: Partial<SigningRequest>) => void;
  resetSession: () => void;
}

export interface PeerStoreState {
  peers: Record<string, Peer>;
  selfPubkey: string | null;
  lastPingTime: Date | null;
  // Actions
  setPeers: (peers: Peer[]) => void;
  updatePeer: (pubkey: string, update: Partial<Peer>) => void;
  updatePeerStatus: (pubkey: string, status: PeerStatus, latency?: number) => void;
  updatePeerPolicy: (pubkey: string, policy: { allowSend?: boolean; allowReceive?: boolean }) => void;
  setSelfPubkey: (pubkey: string) => void;
  setLastPingTime: (time: Date) => void;
  clearPeers: () => void;
}

export interface RelayStoreState {
  relays: string[];
  // Actions
  addRelay: (relay: string) => void;
  removeRelay: (relay: string) => void;
  setRelays: (relays: string[]) => void;
  resetToDefaults: () => void;
}

export interface LogStoreState {
  entries: LogEntry[];
  maxEntries: number;
  filter: LogFilter;
  autoScroll: boolean;
  // Actions
  addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setFilter: (filter: Partial<LogFilter>) => void;
  setMaxEntries: (max: number) => void;
  setAutoScroll: (enabled: boolean) => void;
}

// ============================================
// Service Event Types
// ============================================

export interface IglooServiceEvents {
  'status:changed': (status: SignerStatus) => void;
  'relay:connected': (relay: string) => void;
  'relay:disconnected': (relay: string) => void;
  'signing:request': (request: SigningRequest) => void;
  'signing:complete': (result: SigningResult) => void;
  'signing:error': (error: Error, requestId?: string) => void;
  'peer:status': (pubkey: string, status: PeerStatus, latency?: number) => void;
  'log': (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  'error': (error: Error) => void;
}

// ============================================
// Navigation Types
// ============================================

export type OnboardingStep = 'welcome' | 'scan' | 'manual' | 'confirming';
