export class HistorySyncQueue<TRequest> {
  private readonly pendingByProfile = new Map<string, TRequest>();
  private readonly inFlightProfiles = new Set<string>();
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly retryAttempts = new Map<string, number>();
  private readonly cancelledProfiles = new Set<string>();
  private readonly send: (profileId: string, request: TRequest) => Promise<void>;
  private readonly onError?: (error: unknown, profileId: string) => void;
  private readonly retryDelayMs: (attempt: number) => number;
  private disposed = false;

  constructor(
    send: (profileId: string, request: TRequest) => Promise<void>,
    onError?: (error: unknown, profileId: string) => void,
    retryDelayMs: (attempt: number) => number = (attempt) => (
      Math.min(60_000, 1_000 * (2 ** Math.min(6, Math.max(0, attempt - 1))))
    ),
  ) {
    this.send = send;
    this.onError = onError;
    this.retryDelayMs = retryDelayMs;
  }

  enqueue(profileId: string, request: TRequest) {
    if (this.disposed) return;
    // Keep only the newest complete snapshot while a request is in flight.
    this.cancelledProfiles.delete(profileId);
    this.pendingByProfile.set(profileId, request);
    const retryTimer = this.retryTimers.get(profileId);
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer);
      this.retryTimers.delete(profileId);
    }
    // A fresh snapshot should not inherit the previous snapshot's backoff.
    this.retryAttempts.delete(profileId);
    void this.flush(profileId);
  }

  private async flush(profileId: string): Promise<void> {
    if (this.disposed || this.inFlightProfiles.has(profileId)) return;
    const request = this.pendingByProfile.get(profileId);
    if (request === undefined) return;

    this.pendingByProfile.delete(profileId);
    this.inFlightProfiles.add(profileId);
    try {
      await this.send(profileId, request);
      this.retryAttempts.delete(profileId);
    } catch (error) {
      if (this.disposed || this.cancelledProfiles.has(profileId)) return;
      this.onError?.(error, profileId);
      // A newer snapshot queued while this request was in flight wins. If there
      // is none, put this one back and retry with bounded exponential backoff.
      if (!this.pendingByProfile.has(profileId)) {
        this.pendingByProfile.set(profileId, request);
        this.scheduleRetry(profileId);
      }
    } finally {
      this.inFlightProfiles.delete(profileId);
      if (
        !this.disposed
        && !this.cancelledProfiles.has(profileId)
        && this.pendingByProfile.has(profileId)
        && !this.retryTimers.has(profileId)
      ) {
        void this.flush(profileId);
      }
    }
  }

  private scheduleRetry(profileId: string) {
    if (this.disposed || this.retryTimers.has(profileId)) return;
    const attempt = (this.retryAttempts.get(profileId) ?? 0) + 1;
    this.retryAttempts.set(profileId, attempt);
    const retryTimer = setTimeout(() => {
      this.retryTimers.delete(profileId);
      void this.flush(profileId);
    }, this.retryDelayMs(attempt));
    this.retryTimers.set(profileId, retryTimer);
  }

  cancel(profileId: string) {
    this.cancelledProfiles.add(profileId);
    this.pendingByProfile.delete(profileId);
    const retryTimer = this.retryTimers.get(profileId);
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    this.retryTimers.delete(profileId);
    this.retryAttempts.delete(profileId);
  }

  dispose() {
    this.disposed = true;
    for (const retryTimer of this.retryTimers.values()) clearTimeout(retryTimer);
    this.retryTimers.clear();
    this.retryAttempts.clear();
    this.pendingByProfile.clear();
    this.cancelledProfiles.clear();
  }
}
