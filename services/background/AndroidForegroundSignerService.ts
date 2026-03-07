class AndroidForegroundSignerService {
  // TODO: Replace this stub with a native Android foreground service module.
  // Until then, Android signer keepalive is explicitly disabled by isAvailable().
  async start(): Promise<void> {
    if (!this.isAvailable()) return;
  }

  async stop(): Promise<void> {
    if (!this.isAvailable()) return;
  }

  isRunning(): boolean {
    return false;
  }

  isAvailable(): boolean {
    return false;
  }
}

export const androidForegroundSignerService = new AndroidForegroundSignerService();
