import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginProfileListenDelivery,
  createProfileListenDeliveryState,
  finishProfileListenDelivery,
} from '../lib/profile-listen-delivery.ts';

import {
  formatPairingCodeInput,
  IDLE_PLAYER_TRACK,
  normalizePairingCodeInput,
  pairingCodeInputSegments,
  projectRemotePlaybackProgress,
  reconcileOptimisticRemoteUpdates,
  remoteSnapshotAgeSeconds,
  replacePairingCodeInputSegment,
  resolvePlaybackQueueIndex,
  shouldBeginProfileListenCycle,
} from '../app/spice-client-runtime.ts';

test('fresh player state is an explicit idle prompt with zero duration', () => {
  assert.equal(IDLE_PLAYER_TRACK.id, 'placeholder');
  assert.equal(IDLE_PLAYER_TRACK.title, 'Start playing something');
  assert.equal(IDLE_PLAYER_TRACK.durationMs, 0);
});

test('pairing code input keeps an unambiguous XXXX-XXXX format', () => {
  assert.equal(normalizePairingCodeInput('abci - 2345'), 'ABC2345');
  assert.equal(formatPairingCodeInput('abcd2345'), 'ABCD-2345');
  assert.deepEqual(pairingCodeInputSegments('ABCD-2345'), {
    first: 'ABCD',
    second: '2345',
    normalized: 'ABCD2345',
  });
  assert.equal(replacePairingCodeInputSegment('ABCD2345', 'second', '6789'), 'ABCD6789');
  assert.equal(normalizePairingCodeInput('ＡＢＣＤ—2345'), 'ABCD2345');
});

test('receiver snapshots replace acknowledged optimistic metadata without hiding resolved duration', () => {
  const remaining = reconcileOptimisticRemoteUpdates({
    currentTrack: { id: 'track-1' },
    queue: [{ id: 'track-1' }],
    queueIndex: 0,
    isPlaying: true,
    progress: 2,
    duration: 183,
  }, {
    currentTrack: { id: 'track-1' },
    queue: [{ id: 'track-1' }],
    queueIndex: 0,
    isPlaying: true,
    progress: 0,
    duration: 0,
  });

  assert.equal(remaining, null);
});

test('receiver reconciliation keeps fields that have not been acknowledged yet', () => {
  assert.deepEqual(reconcileOptimisticRemoteUpdates({
    currentTrack: { id: 'old-track' },
    isPlaying: false,
    progress: 41,
  }, {
    currentTrack: { id: 'new-track' },
    isPlaying: true,
    progress: 0,
  }), {
    currentTrack: { id: 'new-track' },
    isPlaying: true,
    progress: 0,
  });
});

test('a new listen cycle is created for real playback starts but not retries or sync refreshes', () => {
  assert.equal(shouldBeginProfileListenCycle({ isRetryCall: false, isSyncLoopCall: false }), true);
  assert.equal(shouldBeginProfileListenCycle({ isRetryCall: true, isSyncLoopCall: false }), false);
  assert.equal(shouldBeginProfileListenCycle({ isRetryCall: false, isSyncLoopCall: true }), false);
  assert.equal(shouldBeginProfileListenCycle({
    isRetryCall: false,
    isSyncLoopCall: false,
    preserveCurrentCycle: true,
  }), false);
});

test('repeat playback cycles of the same track have independent exactly-once delivery state', () => {
  const firstCycle = createProfileListenDeliveryState('youtube:same-track', 1_000);
  assert.deepEqual(beginProfileListenDelivery(firstCycle, 'scrobble', ['lastfm'], 1_000), ['lastfm']);
  finishProfileListenDelivery(firstCycle, 'scrobble', { lastfm: true }, 1_100);
  assert.deepEqual(beginProfileListenDelivery(firstCycle, 'scrobble', ['lastfm'], 1_200), []);

  const repeatedCycle = createProfileListenDeliveryState('youtube:same-track', 2_000);
  assert.deepEqual(beginProfileListenDelivery(repeatedCycle, 'scrobble', ['lastfm'], 2_000), ['lastfm']);
});

test('remote playback progress advances locally between device snapshots and clamps to duration', () => {
  assert.equal(projectRemotePlaybackProgress({
    progress: 12,
    duration: 100,
    isPlaying: true,
    syncedAtMs: 1_000,
  }, 3_500), 14.5);
  assert.equal(projectRemotePlaybackProgress({
    progress: 99,
    duration: 100,
    isPlaying: true,
    syncedAtMs: 1_000,
  }, 10_000), 100);
  assert.equal(projectRemotePlaybackProgress({
    progress: 12,
    duration: 100,
    isPlaying: false,
    syncedAtMs: 1_000,
  }, 3_500), 12);
});

test('remote queue index honors a matching hint and safely falls back by track id', () => {
  const queue = [{ id: 'same' }, { id: 'other' }, { id: 'same' }];
  assert.equal(resolvePlaybackQueueIndex(queue, queue[2], 2), 2);
  assert.equal(resolvePlaybackQueueIndex(queue, { id: 'other' }, 0), 1);
  assert.equal(resolvePlaybackQueueIndex(queue, { id: 'missing' }, 9), 0);
});

test('remote device age uses server time so controller clock skew cannot hide a live receiver', () => {
  assert.equal(remoteSnapshotAgeSeconds(
    '2026-07-14T12:00:00.000Z',
    '2026-07-14T12:00:08.000Z',
    Date.parse('2026-07-14T14:00:00.000Z'),
  ), 8);
  assert.equal(remoteSnapshotAgeSeconds('invalid', null, 1_000), Number.POSITIVE_INFINITY);
});
