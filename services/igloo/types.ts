// Service-specific types for IglooService
// Note: NodeEventConfig is imported from @frostr/igloo-core

export interface StartSignerOptions {
  connectionTimeout?: number;
  autoReconnect?: boolean;
}

export interface StopSignerOptions {
  keepAudio?: boolean;
  keepForegroundService?: boolean;
  cancelPendingStart?: boolean;
}
