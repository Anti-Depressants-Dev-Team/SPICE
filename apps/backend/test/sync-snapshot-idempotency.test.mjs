import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { tsImport } from 'tsx/esm/api';

const tsconfig = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
const historyRoute = await tsImport('../app/api/sync/history/route.ts', {
  parentURL: import.meta.url,
  tsconfig,
});
const likesRoute = await tsImport('../app/api/sync/likes/route.ts', {
  parentURL: import.meta.url,
  tsconfig,
});

const first = {
  sourceId: 'youtube_music',
  trackId: 'track-1',
  title: 'First',
  artistsJson: '[{"id":"artist-1","name":"Artist"}]',
  artworkUrl: 'https://example.com/first.jpg',
  durationMs: 180000,
  msListened: 30000,
};
const second = {
  sourceId: 'soundcloud',
  trackId: 'track-2',
  title: 'Second',
  artistsJson: '[]',
  artworkUrl: null,
  durationMs: null,
  msListened: 30000,
};

test('history snapshot equality preserves playback order and normalized metadata', () => {
  assert.equal(historyRoute.historySnapshotsMatch([first, second], [{ ...first }, { ...second }]), true);
  assert.equal(historyRoute.historySnapshotsMatch([first, second], [second, first]), false);
  assert.equal(
    historyRoute.historySnapshotsMatch([first], [{ ...first, title: 'Changed' }]),
    false,
  );
  assert.equal(historyRoute.historySnapshotsMatch([first, second], [first]), false);

  const stored = [
    { ...first, id: 'history-1', playedAt: new Date('2026-07-13T07:00:00Z') },
    { ...second, id: 'history-2', playedAt: new Date('2026-07-13T06:00:00Z') },
  ];
  assert.deepEqual(
    historyRoute.planHistorySnapshotChanges(stored, [{ ...first }, { ...second }]),
    { kind: 'unchanged', insert: [], removeIds: [] },
  );
  assert.deepEqual(
    historyRoute.planHistorySnapshotChanges(stored, [{ ...first }]),
    { kind: 'trim', insert: [], removeIds: ['history-2'] },
  );
  assert.deepEqual(
    historyRoute.planHistorySnapshotChanges(
      [
        { ...second, id: 'history-newer', playedAt: new Date('2026-07-13T08:00:00Z') },
        { ...first, id: 'history-older', playedAt: new Date('2026-07-13T07:00:00Z') },
      ],
      [{ ...first }],
    ),
    { kind: 'unchanged', insert: [], removeIds: [] },
  );
  assert.deepEqual(
    historyRoute.planHistorySnapshotChanges(stored, [{ ...second, trackId: 'new-track' }, first]),
    {
      kind: 'prepend',
      insert: [{ ...second, trackId: 'new-track' }],
      removeIds: ['history-2'],
    },
  );

  assert.deepEqual(
    historyRoute.planHistorySnapshotChanges(stored, [{ ...first, msListened: 60000 }, second]),
    {
      kind: 'patch',
      insert: [],
      removeIds: [],
      update: [{ id: 'history-1', item: { ...first, msListened: 60000 } }],
    },
  );
  assert.deepEqual(
    historyRoute.planHistorySnapshotChanges(stored, [{ ...second, msListened: 60000 }, first]),
    {
      kind: 'promote',
      insert: [],
      removeIds: [],
      update: [{ id: 'history-2', item: { ...second, msListened: 60000 } }],
    },
  );
  assert.deepEqual(
    historyRoute.preserveMonotonicListenCredit(
      [{ ...first, msListened: 90000 }],
      [{ ...first, msListened: 30000 }],
    ),
    [{ ...first, msListened: 90000 }],
  );
});

test('like snapshot equality treats favorites as an unordered normalized set', () => {
  assert.equal(likesRoute.likeSnapshotsMatch([first, second], [{ ...second }, { ...first }]), true);
  assert.equal(
    likesRoute.likeSnapshotsMatch([first], [{ ...first, sourceId: 'soundcloud' }]),
    false,
  );
  assert.equal(likesRoute.likeSnapshotsMatch([first, second], [first]), false);

  const plan = likesRoute.planLikeSnapshotChanges(
    [first, second],
    [{ ...first, title: 'Updated' }, { ...second, sourceId: 'youtube_music' }],
  );
  assert.deepEqual(plan.remove, [second]);
  assert.deepEqual(plan.insert, [{ ...second, sourceId: 'youtube_music' }]);
  assert.deepEqual(plan.update, [{ ...first, title: 'Updated' }]);
});
