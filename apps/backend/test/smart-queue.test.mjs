import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSmartQueue,
  smartQueueArtistKeys,
  smartQueueTrackKey,
} from '../app/smart-queue.ts';

const track = (id, sourceId, artistId, smartQueueScore = 0) => ({
  id,
  sourceId,
  title: id,
  artists: [{ id: artistId, name: artistId }],
  smartQueueScore,
});

test('smart queue keys include source and normalized artist identities', () => {
  const candidate = {
    id: 'Track-A',
    sourceId: 'SoundCloud',
    artists: [{ id: 'ARTIST-1' }, { name: 'Other Artist' }, { id: 'ARTIST-1' }],
  };

  assert.equal(smartQueueTrackKey(candidate), 'soundcloud:track-a');
  assert.deepEqual(smartQueueArtistKeys(candidate), ['artist-1', 'other artist']);
});

test('buildSmartQueue excludes recent tracks and duplicate candidates', () => {
  const a = track('a', 'youtube_music', 'artist-a');
  const duplicateA = { ...a };
  const b = track('b', 'soundcloud', 'artist-b');
  const c = track('c', 'youtube_music', 'artist-c');

  const result = buildSmartQueue([a, duplicateA, b, c], {
    recentTrackKeys: ['soundcloud:b'],
  });

  assert.deepEqual(result.map((entry) => entry.id), ['a', 'c']);
});

test('buildSmartQueue interleaves equal-score sources deterministically', () => {
  const candidates = [
    track('a', 'youtube_music', 'artist-a'),
    track('b', 'youtube_music', 'artist-b'),
    track('c', 'soundcloud', 'artist-c'),
  ];

  const first = buildSmartQueue(candidates);
  const second = buildSmartQueue(candidates);

  assert.deepEqual(first.map((entry) => entry.id), ['a', 'c', 'b']);
  assert.deepEqual(second, first);
  assert.deepEqual(candidates.map((entry) => entry.id), ['a', 'b', 'c']);
});

test('buildSmartQueue favors artist diversity after each selection', () => {
  const result = buildSmartQueue([
    track('a', 'youtube_music', 'same-artist'),
    track('b', 'soundcloud', 'same-artist'),
    track('c', 'soundcloud', 'different-artist'),
  ], {
    sourceDiversityPenalty: 0,
    artistDiversityPenalty: 20,
  });

  assert.deepEqual(result.map((entry) => entry.id), ['a', 'c', 'b']);
});

test('buildSmartQueue applies liked boosts and recent-artist penalties', () => {
  const a = track('a', 'youtube_music', 'recent-artist');
  const b = track('b', 'youtube_music', 'fresh-artist');
  const c = track('c', 'soundcloud', 'freshest-artist');

  assert.deepEqual(buildSmartQueue([a, b, c], {
    recentArtistKeys: ['recent-artist'],
    recentArtistPenalty: 30,
    sourceDiversityPenalty: 0,
    artistDiversityPenalty: 0,
  }).map((entry) => entry.id), ['b', 'c', 'a']);

  assert.equal(buildSmartQueue([a, b, c], {
    likedTrackIds: ['c'],
    likedBoost: 50,
  })[0], c);
});

test('buildSmartQueue honors base scores, zero limits, and hard limits', () => {
  const candidates = [
    track('a', 'youtube_music', 'artist-a', 1),
    track('b', 'soundcloud', 'artist-b', 8),
    track('c', 'youtube_music', 'artist-c', 3),
  ];

  assert.deepEqual(buildSmartQueue(candidates, { limit: 0 }), []);
  assert.deepEqual(buildSmartQueue(candidates, {
    limit: 2,
    sourceDiversityPenalty: 0,
    artistDiversityPenalty: 0,
  }).map((entry) => entry.id), ['b', 'c']);
});
