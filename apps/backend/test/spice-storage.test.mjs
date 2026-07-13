import assert from 'node:assert/strict';
import test from 'node:test';

import {
  enrichTrackSnapshot,
  enrichTrackSnapshots,
  getPlaybackState,
  savePlaybackProgress,
  savePlaybackState,
} from '../app/spice-storage.ts';

const TRACK_SNAPSHOTS_KEY = 'spice_track_snapshots_v1';
const PLAYBACK_STATES_KEY = 'spice_playback_states_v1';
const PLAYBACK_PROGRESS_KEY = 'spice_playback_progress_v1';

function withStorage(values, run) {
  const previousWindow = globalThis.window;
  let reads = 0;

  globalThis.window = {
    localStorage: {
      getItem(key) {
        reads += 1;
        return Object.hasOwn(values, key) ? values[key] : null;
      },
    },
  };

  try {
    return run(() => reads);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

function withWritableStorage(initialValues, run) {
  const previousWindow = globalThis.window;
  const values = new Map(Object.entries(initialValues));
  const writes = new Map();

  globalThis.window = {
    localStorage: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
        writes.set(key, (writes.get(key) ?? 0) + 1);
      },
      removeItem(key) {
        values.delete(key);
      },
    },
  };

  try {
    return run({ values, writes });
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

test('enrichTrackSnapshots reads the snapshot store once for a large batch', () => {
  const storedTrack = {
    id: 'track-0',
    title: 'Stored title',
    artists: [{ id: 'artist-0', name: 'Stored artist' }],
    artworkUrl: 'https://example.com/stored.jpg',
    durationMs: 123_000,
  };
  const tracks = Array.from({ length: 802 }, (_, index) => ({
    id: `track-${index}`,
    title: index === 0 ? 'Track' : `Incoming ${index}`,
    artists: [],
  }));

  withStorage({
    [TRACK_SNAPSHOTS_KEY]: JSON.stringify({
      [storedTrack.id]: { track: storedTrack, savedAt: 1 },
    }),
  }, (getReads) => {
    const enriched = enrichTrackSnapshots(tracks);

    assert.equal(getReads(), 1);
    assert.equal(enriched.length, tracks.length);
    assert.equal(enriched[0].title, storedTrack.title);
    assert.deepEqual(enriched[0].artists, storedTrack.artists);
    assert.equal(enriched[0].artworkUrl, storedTrack.artworkUrl);
    assert.equal(enriched[0].durationMs, storedTrack.durationMs);
    assert.strictEqual(enriched[801], tracks[801]);
  });
});

test('enrichTrackSnapshot preserves the single-track lookup behavior', () => {
  const storedTrack = {
    id: 'legacy-track',
    title: 'Legacy title',
    artists: [{ id: 'legacy-artist', name: 'Legacy artist' }],
    sourceId: 'youtube_music',
  };

  withStorage({
    [TRACK_SNAPSHOTS_KEY]: JSON.stringify({
      [storedTrack.id]: { track: storedTrack, savedAt: 1 },
    }),
  }, (getReads) => {
    const enriched = enrichTrackSnapshot({
      id: storedTrack.id,
      title: 'Track',
      artists: [],
    });

    assert.equal(getReads(), 1);
    assert.equal(enriched.title, storedTrack.title);
    assert.deepEqual(enriched.artists, storedTrack.artists);
    assert.equal(enriched.sourceId, storedTrack.sourceId);
  });
});

test('savePlaybackState preserves a large queue and active index for restart recovery', () => {
  const queue = Array.from({ length: 802 }, (_, index) => ({
    id: `track-${index}`,
    title: `Track ${index}`,
    artists: [{ id: 'artist', name: 'Artist' }],
  }));

  withWritableStorage({}, ({ values }) => {
    savePlaybackState('profile-1', {
      currentTrack: queue[401],
      queue,
      queueIndex: 401,
      progress: 12,
      savedAt: 100,
    });

    const persisted = JSON.parse(values.get(PLAYBACK_STATES_KEY))['profile-1'];
    assert.equal(persisted.queue.length, 802);
    assert.equal(persisted.queueIndex, 401);
    assert.equal(persisted.queue[persisted.queueIndex].id, queue[401].id);
  });
});

test('frequent progress saves do not rewrite the full playback queue', () => {
  const track = {
    id: 'track-1',
    title: 'Track 1',
    artists: [{ id: 'artist', name: 'Artist' }],
  };

  withWritableStorage({}, ({ writes }) => {
    savePlaybackState('profile-1', {
      currentTrack: track,
      queue: [track],
      queueIndex: 0,
      progress: 5,
      savedAt: 100,
    });
    savePlaybackProgress('profile-1', track, 10, 200);
    savePlaybackProgress('profile-1', track, 15, 300);

    assert.equal(writes.get(PLAYBACK_STATES_KEY), 1);
    assert.equal(writes.get(PLAYBACK_PROGRESS_KEY), 3);
  });
});

test('getPlaybackState applies a newer lightweight progress snapshot', () => {
  const track = {
    id: 'track-1',
    title: 'Track 1',
    artists: [{ id: 'artist', name: 'Artist' }],
  };

  withWritableStorage({
    [PLAYBACK_STATES_KEY]: JSON.stringify({
      'profile-1': {
        currentTrack: track,
        queue: [track],
        queueIndex: 0,
        progress: 5,
        savedAt: 100,
      },
    }),
    [PLAYBACK_PROGRESS_KEY]: JSON.stringify({
      'profile-1': { trackKey: 'unknown:track-1', progress: 42, savedAt: 200 },
    }),
  }, () => {
    const restored = getPlaybackState('profile-1');
    assert.equal(restored?.progress, 42);
    assert.equal(restored?.savedAt, 200);
  });
});

test('getPlaybackState ignores progress saved for a different track', () => {
  const track = {
    id: 'track-1',
    title: 'Track 1',
    artists: [{ id: 'artist', name: 'Artist' }],
  };

  withWritableStorage({
    [PLAYBACK_STATES_KEY]: JSON.stringify({
      'profile-1': {
        currentTrack: track,
        queue: [track],
        queueIndex: 0,
        progress: 5,
        savedAt: 100,
      },
    }),
    [PLAYBACK_PROGRESS_KEY]: JSON.stringify({
      'profile-1': { trackKey: 'unknown:track-2', progress: 42, savedAt: 200 },
    }),
  }, () => {
    const restored = getPlaybackState('profile-1');
    assert.equal(restored?.progress, 5);
    assert.equal(restored?.savedAt, 100);
  });
});
