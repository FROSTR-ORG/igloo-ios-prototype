class AndroidForegroundSignerService {
  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  isRunning(): boolean {
    return false;
  }

  isAvailable(): boolean {
    return false;
  }
}

export const androidForegroundSignerService = new AndroidForegroundSignerService();
