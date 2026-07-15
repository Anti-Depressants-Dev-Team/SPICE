import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FORGOTTEN_FAVORITE_MIN_LISTEN_MS,
  HOME_RECENTLY_PLAYED_LIMIT,
  buildHomeHistoryShelves,
} from '../app/home-history.ts';

const track = (id, msListened = 0, sourceId = 'youtube_music') => ({
  id,
  sourceId,
  msListened,
  title: `Track ${id}`,
});

test('recently played contains only the newest unique profile-history tracks', () => {
  const history = Array.from({ length: 11 }, (_, index) => track(`track-${index + 1}`));
  const shelves = buildHomeHistoryShelves(history);

  assert.equal(shelves.recentlyPlayed.length, HOME_RECENTLY_PLAYED_LIMIT);
  assert.deepEqual(
    shelves.recentlyPlayed.map((item) => item.id),
    history.slice(0, HOME_RECENTLY_PLAYED_LIMIT).map((item) => item.id),
  );
});

test('forgotten favorites require at least three meaningful listens', () => {
  const recent = Array.from({ length: HOME_RECENTLY_PLAYED_LIMIT }, (_, index) => (
    track(`recent-${index + 1}`, FORGOTTEN_FAVORITE_MIN_LISTEN_MS * 2)
  ));
  const history = [
    ...recent,
    track('not-played-enough', FORGOTTEN_FAVORITE_MIN_LISTEN_MS - 1),
    track('qualifies-at-threshold', FORGOTTEN_FAVORITE_MIN_LISTEN_MS),
  ];

  const shelves = buildHomeHistoryShelves(history);

  assert.deepEqual(
    shelves.forgottenFavorites.map((item) => item.id),
    ['qualifies-at-threshold'],
  );
});

test('forgotten favorites prefer the least recently played qualifying songs', () => {
  const recent = Array.from({ length: HOME_RECENTLY_PLAYED_LIMIT }, (_, index) => (
    track(`recent-${index + 1}`)
  ));
  const history = [
    ...recent,
    track('older', FORGOTTEN_FAVORITE_MIN_LISTEN_MS * 5),
    track('oldest', FORGOTTEN_FAVORITE_MIN_LISTEN_MS),
  ];

  const shelves = buildHomeHistoryShelves(history);

  assert.deepEqual(
    shelves.forgottenFavorites.map((item) => item.id),
    ['oldest', 'older'],
  );
});

test('a song shown in recently played can never appear in forgotten favorites', () => {
  const recentFavorite = track('same-song', FORGOTTEN_FAVORITE_MIN_LISTEN_MS * 4);
  const recent = [
    recentFavorite,
    ...Array.from({ length: HOME_RECENTLY_PLAYED_LIMIT - 1 }, (_, index) => track(`recent-${index + 1}`)),
  ];
  const history = [
    ...recent,
    track('same-song', FORGOTTEN_FAVORITE_MIN_LISTEN_MS * 4),
    track('old-favorite', FORGOTTEN_FAVORITE_MIN_LISTEN_MS * 2),
  ];

  const shelves = buildHomeHistoryShelves(history);
  const recentKeys = new Set(shelves.recentlyPlayed.map((item) => `${item.sourceId}:${item.id}`));

  assert.deepEqual(shelves.forgottenFavorites.map((item) => item.id), ['old-favorite']);
  assert.equal(
    shelves.forgottenFavorites.some((item) => recentKeys.has(`${item.sourceId}:${item.id}`)),
    false,
  );
});

test('same ids from different providers remain separate songs', () => {
  const recent = [
    track('shared-id', FORGOTTEN_FAVORITE_MIN_LISTEN_MS, 'youtube_music'),
    ...Array.from({ length: HOME_RECENTLY_PLAYED_LIMIT - 1 }, (_, index) => track(`recent-${index + 1}`)),
  ];
  const history = [
    ...recent,
    track('shared-id', FORGOTTEN_FAVORITE_MIN_LISTEN_MS, 'soundcloud'),
  ];

  const shelves = buildHomeHistoryShelves(history);

  assert.equal(shelves.forgottenFavorites.length, 1);
  assert.equal(shelves.forgottenFavorites[0].sourceId, 'soundcloud');
});
