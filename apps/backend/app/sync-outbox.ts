export type SyncOutboxStatus = 'pending' | 'retrying' | 'attention';

export interface SyncOutboxItem<TPayload> {
  profileId: string;
  kind: string;
  payload: TPayload;
  updatedAt: number;
  attempts: number;
  status: SyncOutboxStatus;
  error?: string;
}

export interface SyncOutboxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface DurableSyncOutboxOptions<TPayload> {
  storage?: SyncOutboxStorage | null;
  storageKey?: string;
  send: (item: SyncOutboxItem<TPayload>) => Promise<void>;
  retryDelayMs?: (attempt: number) => number;
  onChange?: (items: SyncOutboxItem<TPayload>[]) => void;
  onError?: (error: unknown, item: SyncOutboxItem<TPayload>) => void;
}

export class SyncOutboxPermanentError extends Error {}

const itemKey = (profileId: string, kind: string) => `${profileId}\u0000${kind}`;

const validItem = <TPayload>(value: unknown): value is SyncOutboxItem<TPayload> => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SyncOutboxItem<TPayload>>;
  return typeof item.profileId === 'string'
    && Boolean(item.profileId)
    && typeof item.kind === 'string'
    && Boolean(item.kind)
    && Number.isFinite(item.updatedAt)
    && item.payload !== undefined;
};

export class DurableSyncOutbox<TPayload> {
  private readonly storage: SyncOutboxStorage | null;
  private readonly storageKey: string;
  private readonly send: (item: SyncOutboxItem<TPayload>) => Promise<void>;
  private readonly retryDelayMs: (attempt: number) => number;
  private readonly onChange?: (items: SyncOutboxItem<TPayload>[]) => void;
  private readonly onError?: (error: unknown, item: SyncOutboxItem<TPayload>) => void;
  private readonly items = new Map<string, SyncOutboxItem<TPayload>>();
  private readonly inFlight = new Set<string>();
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private disposed = false;

  constructor(options: DurableSyncOutboxOptions<TPayload>) {
    this.storage = options.storage ?? null;
    this.storageKey = options.storageKey ?? 'spice_sync_outbox_v1';
    this.send = options.send;
    this.retryDelayMs = options.retryDelayMs ?? ((attempt) => (
      Math.min(60_000, 1_000 * (2 ** Math.min(6, Math.max(0, attempt - 1))))
    ));
    this.onChange = options.onChange;
    this.onError = options.onError;
    this.restore();
  }

  enqueue(profileId: string, kind: string, payload: TPayload) {
    if (this.disposed || !profileId || !kind) return;
    const key = itemKey(profileId, kind);
    const timer = this.retryTimers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    this.retryTimers.delete(key);
    const updatedAt = Math.max(Date.now(), (this.items.get(key)?.updatedAt ?? 0) + 1);
    this.items.set(key, {
      profileId,
      kind,
      payload,
      updatedAt,
      attempts: 0,
      status: 'pending',
    });
    this.persist();
    void this.flushKey(key);
  }

  async flushAll() {
    if (this.disposed) return;
    await Promise.all(Array.from(this.items.keys(), (key) => this.flushKey(key)));
  }

  retryAttentionItems() {
    for (const [key, item] of this.items) {
      if (item.status !== 'attention') continue;
      this.items.set(key, { ...item, attempts: 0, status: 'pending', error: undefined });
    }
    this.persist();
    void this.flushAll();
  }

  cancelProfile(profileId: string) {
    for (const key of Array.from(this.items.keys())) {
      if (!key.startsWith(`${profileId}\u0000`)) continue;
      this.items.delete(key);
      const timer = this.retryTimers.get(key);
      if (timer !== undefined) clearTimeout(timer);
      this.retryTimers.delete(key);
    }
    this.persist();
  }

  snapshot() {
    return Array.from(this.items.values(), (item) => ({ ...item }));
  }

  dispose() {
    this.disposed = true;
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();
    this.inFlight.clear();
  }

  private restore() {
    if (!this.storage) return;
    try {
      const parsed = JSON.parse(this.storage.getItem(this.storageKey) || '[]') as unknown;
      if (!Array.isArray(parsed)) return;
      parsed.filter(validItem<TPayload>).forEach((item) => {
        this.items.set(itemKey(item.profileId, item.kind), {
          ...item,
          attempts: Number.isFinite(item.attempts) ? Math.max(0, Math.round(item.attempts)) : 0,
          status: item.status === 'attention' ? 'attention' : 'pending',
          error: typeof item.error === 'string' ? item.error : undefined,
        });
      });
      this.emitChange();
    } catch {
      this.storage.removeItem(this.storageKey);
    }
  }

  private async flushKey(key: string): Promise<void> {
    if (this.disposed || this.inFlight.has(key)) return;
    const item = this.items.get(key);
    if (!item || item.status === 'attention') return;

    this.inFlight.add(key);
    const sentVersion = item.updatedAt;
    try {
      await this.send({ ...item });
      const current = this.items.get(key);
      if (current?.updatedAt === sentVersion) this.items.delete(key);
    } catch (error) {
      const current = this.items.get(key);
      if (!current || current.updatedAt !== sentVersion || this.disposed) return;
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof SyncOutboxPermanentError) {
        this.items.set(key, { ...current, status: 'attention', error: message });
      } else {
        const attempts = current.attempts + 1;
        this.items.set(key, { ...current, attempts, status: 'retrying', error: message });
        this.scheduleRetry(key, attempts);
      }
      this.onError?.(error, current);
    } finally {
      this.inFlight.delete(key);
      this.persist();
      const current = this.items.get(key);
      if (current && current.updatedAt !== sentVersion && current.status !== 'attention') {
        void this.flushKey(key);
      }
    }
  }

  private scheduleRetry(key: string, attempts: number) {
    if (this.disposed || this.retryTimers.has(key)) return;
    const timer = setTimeout(() => {
      this.retryTimers.delete(key);
      const current = this.items.get(key);
      if (current?.status === 'retrying') {
        this.items.set(key, { ...current, status: 'pending' });
      }
      this.persist();
      void this.flushKey(key);
    }, this.retryDelayMs(attempts));
    this.retryTimers.set(key, timer);
  }

  private persist() {
    if (this.storage) {
      try {
        if (this.items.size === 0) {
          this.storage.removeItem(this.storageKey);
        } else {
          this.storage.setItem(this.storageKey, JSON.stringify(Array.from(this.items.values())));
        }
      } catch {
        // Sync must remain functional when browser storage is unavailable.
      }
    }
    this.emitChange();
  }

  private emitChange() {
    this.onChange?.(this.snapshot());
  }
}
