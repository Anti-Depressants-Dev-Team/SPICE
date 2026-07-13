import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PLAYBACK_PROFILE,
  loadPlaybackProfileState,
  normalizePlaybackProfile,
  normalizePlaybackProfileState,
  PLAYBACK_PROFILE_SCHEMA_VERSION,
  PLAYBACK_PROFILE_STORAGE_KEY,
  savePlaybackProfileState,
  validatePlaybackProfile,
} from '../app/playback-profiles.ts';

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

test('default playback profile satisfies the strict schema', () => {
  assert.deepEqual(validatePlaybackProfile(DEFAULT_PLAYBACK_PROFILE), {
    valid: true,
    errors: [],
  });
});

test('validatePlaybackProfile reports invalid nested settings', () => {
  const result = validatePlaybackProfile({
    id: 'bad id',
    name: '',
    crossfade: { enabled: 'yes', durationMs: 99_000, curve: 'logarithmic' },
    smartQueue: { enabled: true, recentTrackWindow: -1 },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('id must')));
  assert.ok(result.errors.some((error) => error.startsWith('name must')));
  assert.ok(result.errors.includes('crossfade.enabled must be boolean'));
  assert.ok(result.errors.some((error) => error.startsWith('crossfade.durationMs')));
  assert.ok(result.errors.includes('crossfade.curve must be linear or equal-power'));
  assert.ok(result.errors.some((error) => error.startsWith('smartQueue.recentTrackWindow')));
});

test('normalizePlaybackProfile sanitizes identity and clamps feature settings', () => {
  const profile = normalizePlaybackProfile({
    id: '  Party Mode!!  ',
    name: '  Party Mode  ',
    crossfade: { enabled: true, durationMs: 99_000, curve: 'linear' },
    smartQueue: {
      enabled: false,
      recentTrackWindow: 250,
      recentArtistWindow: -10,
      likedBoost: 150,
      recentArtistPenalty: -2,
      sourceDiversityPenalty: 8.5,
      artistDiversityPenalty: 12.25,
    },
  });

  assert.equal(profile.id, 'party-mode');
  assert.equal(profile.name, 'Party Mode');
  assert.deepEqual(profile.crossfade, {
    enabled: true,
    durationMs: 12_000,
    curve: 'linear',
  });
  assert.deepEqual(profile.smartQueue, {
    enabled: false,
    recentTrackWindow: 100,
    recentArtistWindow: 0,
    likedBoost: 100,
    recentArtistPenalty: 0,
    sourceDiversityPenalty: 8.5,
    artistDiversityPenalty: 12.25,
  });

  assert.equal(normalizePlaybackProfile({ id: '__Focus', name: 'Focus' }).id, 'focus');
});

test('normalizePlaybackProfileState deduplicates profiles and repairs active IDs', () => {
  const state = normalizePlaybackProfileState({
    version: 999,
    activeProfileId: 'missing',
    profiles: [
      DEFAULT_PLAYBACK_PROFILE,
      { ...DEFAULT_PLAYBACK_PROFILE, name: 'Duplicate' },
      { ...DEFAULT_PLAYBACK_PROFILE, id: 'focus', name: 'Focus' },
    ],
  });

  assert.equal(state.version, PLAYBACK_PROFILE_SCHEMA_VERSION);
  assert.deepEqual(state.profiles.map((profile) => profile.id), ['balanced', 'focus']);
  assert.equal(state.activeProfileId, 'balanced');
});

test('playback profile persistence round-trips normalized state', () => {
  const storage = new MemoryStorage();
  const saved = savePlaybackProfileState(storage, {
    activeProfileId: 'focus',
    profiles: [{ ...DEFAULT_PLAYBACK_PROFILE, id: 'focus', name: 'Focus' }],
  });

  assert.equal(saved.saved, true);
  assert.equal(saved.state.activeProfileId, 'focus');
  assert.deepEqual(loadPlaybackProfileState(storage), saved.state);
  assert.ok(storage.getItem(PLAYBACK_PROFILE_STORAGE_KEY));
});

test('playback profile persistence falls back on corruption and reports write failures', () => {
  const corruptStorage = new MemoryStorage();
  corruptStorage.setItem(PLAYBACK_PROFILE_STORAGE_KEY, '{broken');
  const fallback = loadPlaybackProfileState(corruptStorage);
  assert.equal(fallback.activeProfileId, DEFAULT_PLAYBACK_PROFILE.id);
  assert.equal(fallback.profiles.length, 1);

  const failingStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
  };
  const result = savePlaybackProfileState(failingStorage, null);
  assert.equal(result.saved, false);
  assert.equal(result.state.activeProfileId, DEFAULT_PLAYBACK_PROFILE.id);
});
