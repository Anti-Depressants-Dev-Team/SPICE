const PAIRING_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const PAIRING_CODE_LENGTH = 8;

export const IDLE_PLAYER_TRACK = {
  id: 'placeholder',
  title: 'Start playing something',
  artists: [{ id: 'spice', name: 'SPICE Player' }],
  artworkUrl: '/icon.svg',
  durationMs: 0,
};

export function normalizePairingCodeInput(value: unknown) {
  if (typeof value !== 'string') return '';
  return [...value.normalize('NFKC').toUpperCase()]
    .filter((character) => PAIRING_CODE_ALPHABET.includes(character))
    .join('')
    .slice(0, PAIRING_CODE_LENGTH);
}

type RemotePlaybackSnapshot = {
  currentTrack?: { id?: string } | null;
  queue?: Array<{ id?: string }>;
  queueIndex?: number;
  isPlaying?: boolean;
  shuffleEnabled?: boolean;
  repeatMode?: string;
  progress?: number;
  duration?: number;
  volume?: number;
};

function sameTrackQueue(
  first: Array<{ id?: string }> | undefined,
  second: Array<{ id?: string }> | undefined,
) {
  if (!first || !second || first.length !== second.length) return false;
  return first.every((track, index) => track.id === second[index]?.id);
}

/**
 * Drops optimistic fields once a receiver snapshot proves they were applied.
 * Unacknowledged fields remain overlaid briefly so controls still feel instant.
 */
export function reconcileOptimisticRemoteUpdates<T extends RemotePlaybackSnapshot>(
  receiver: RemotePlaybackSnapshot,
  optimisticUpdates: T,
): Partial<T> | null {
  const remaining = { ...optimisticUpdates } as Partial<T> & RemotePlaybackSnapshot;
  const sameTrack = Boolean(
    optimisticUpdates.currentTrack?.id
    && receiver.currentTrack?.id === optimisticUpdates.currentTrack.id,
  );

  if (sameTrack) delete remaining.currentTrack;
  if (sameTrackQueue(receiver.queue, optimisticUpdates.queue)) delete remaining.queue;

  const exactFields = ['queueIndex', 'isPlaying', 'shuffleEnabled', 'repeatMode', 'volume'] as const;
  exactFields.forEach((field) => {
    if (optimisticUpdates[field] !== undefined && receiver[field] === optimisticUpdates[field]) {
      delete remaining[field];
    }
  });

  if (
    optimisticUpdates.duration !== undefined
    && sameTrack
    && Number.isFinite(receiver.duration)
    && (receiver.duration as number) > 0
  ) {
    delete remaining.duration;
  }

  if (
    optimisticUpdates.progress !== undefined
    && sameTrack
    && Number.isFinite(receiver.progress)
    && Math.abs((receiver.progress as number) - optimisticUpdates.progress) <= 5
  ) {
    delete remaining.progress;
  }

  return Object.keys(remaining).length > 0 ? remaining as Partial<T> : null;
}

export function formatPairingCodeInput(value: unknown) {
  const normalized = normalizePairingCodeInput(value);
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function pairingCodeInputSegments(value: unknown) {
  const normalized = normalizePairingCodeInput(value);
  return {
    first: normalized.slice(0, 4),
    second: normalized.slice(4, 8),
    normalized,
  };
}

export function replacePairingCodeInputSegment(
  currentValue: unknown,
  segment: 'first' | 'second',
  segmentValue: unknown,
) {
  const current = pairingCodeInputSegments(currentValue);
  const replacement = normalizePairingCodeInput(segmentValue).slice(0, 4);
  return segment === 'first'
    ? `${replacement}${current.second}`
    : `${current.first}${replacement}`;
}

export function shouldBeginProfileListenCycle({
  isRetryCall,
  isSyncLoopCall,
  preserveCurrentCycle = false,
}: {
  isRetryCall: boolean;
  isSyncLoopCall: boolean;
  preserveCurrentCycle?: boolean;
}) {
  return !isRetryCall && !isSyncLoopCall && !preserveCurrentCycle;
}

export function resolvePlaybackQueueIndex<T extends { id: string }>(
  queue: T[],
  track: T,
  queueIndexHint?: number,
) {
  if (
    Number.isInteger(queueIndexHint)
    && queueIndexHint !== undefined
    && queueIndexHint >= 0
    && queueIndexHint < queue.length
    && queue[queueIndexHint]?.id === track.id
  ) {
    return queueIndexHint;
  }

  const matchingIndex = queue.findIndex((entry) => entry.id === track.id);
  return matchingIndex >= 0 ? matchingIndex : 0;
}

export function projectRemotePlaybackProgress(
  state: {
    progress?: number;
    duration?: number;
    isPlaying?: boolean;
    syncedAtMs?: number;
  } | null | undefined,
  nowMs = Date.now(),
) {
  if (!state) return 0;
  const progress = Number.isFinite(state.progress) ? Math.max(0, state.progress as number) : 0;
  const duration = Number.isFinite(state.duration) ? Math.max(0, state.duration as number) : 0;
  const syncedAtMs = Number.isFinite(state.syncedAtMs) ? state.syncedAtMs as number : nowMs;
  const elapsed = state.isPlaying ? Math.max(0, nowMs - syncedAtMs) / 1000 : 0;
  const projected = progress + elapsed;
  return duration > 0 ? Math.min(duration, projected) : projected;
}

export function remoteSnapshotAgeSeconds(
  updatedAt: unknown,
  serverTime: unknown,
  fallbackNowMs = Date.now(),
) {
  const updatedAtMs = typeof updatedAt === 'string' ? Date.parse(updatedAt) : Number.NaN;
  if (!Number.isFinite(updatedAtMs)) return Number.POSITIVE_INFINITY;
  const parsedServerTime = typeof serverTime === 'string' ? Date.parse(serverTime) : Number.NaN;
  const observedAtMs = Number.isFinite(parsedServerTime) ? parsedServerTime : fallbackNowMs;
  return Math.max(0, Math.round((observedAtMs - updatedAtMs) / 1000));
}
