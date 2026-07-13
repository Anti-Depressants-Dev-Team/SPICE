import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeSongsPlayedCount,
  profileWriteMatches,
  profileWriteValues,
} from '../lib/profile-sync.ts';

test('profile sync preserves the highest monotonic songs-played count', () => {
  assert.equal(mergeSongsPlayedCount(149, 0, 50), 149);
  assert.equal(mergeSongsPlayedCount(10, 20, 5), 20);
});

test('profile sync recovers a missing counter from synced history', () => {
  assert.equal(mergeSongsPlayedCount(0, 0, 50), 50);
});

test('profile sync normalizes malformed or negative counters', () => {
  assert.equal(mergeSongsPlayedCount(-4, '12.9', Number.NaN), 12);
});

test('profile writes can skip unchanged rows and detect meaningful changes', () => {
  const input = {
    id: 'default',
    displayName: 'Miku',
    cloudUsername: 'miku',
    gradient: 'purple',
    joinedAt: 'July 2026',
  };
  const stored = profileWriteValues(input);

  assert.equal(profileWriteMatches(stored, input), true);
  assert.equal(profileWriteMatches({ ...stored, songsPlayed: 1 }, input), false);
  assert.equal(profileWriteMatches({ ...stored, avatarUrl: 'https://example.com/avatar.png' }, input), false);
});
