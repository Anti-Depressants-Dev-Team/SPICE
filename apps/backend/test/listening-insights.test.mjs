import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendListeningEvent,
  buildWeeklyListeningRecap,
  normalizeListeningEvents,
} from '../app/listening-insights.ts';

const NOW = Date.UTC(2026, 6, 15, 12);
const event = (id, minutesAgo, options = {}) => ({
  id,
  trackId: options.trackId || id,
  sourceId: options.sourceId || 'youtube_music',
  title: options.title || id,
  artistNames: options.artistNames || ['Artist'],
  listenedMs: options.listenedMs ?? 30_000,
  completedAt: NOW - minutesAgo * 60_000,
  discovered: options.discovered === true,
});

test('weekly recap reports local credited listening, discovery, artists, and sessions', () => {
  const recap = buildWeeklyListeningRecap([
    event('one', 70, { artistNames: ['A'], discovered: true, listenedMs: 120_000 }),
    event('two', 50, { artistNames: ['A'], listenedMs: 60_000 }),
    event('three', 5, { artistNames: ['B'], listenedMs: 30_000, sourceId: 'soundcloud' }),
  ], NOW);

  assert.equal(recap.eventCount, 3);
  assert.equal(recap.uniqueTrackCount, 3);
  assert.equal(recap.creditedMinutes, 3.5);
  assert.equal(recap.discoveryPercent, 33);
  assert.equal(recap.longestSessionMinutes, 3);
  assert.deepEqual(recap.topArtists[0], { name: 'A', listens: 2 });
  assert.equal(recap.topSource, 'youtube_music');
});

test('listening events are deduplicated and old or malformed rows are pruned', () => {
  const initial = [event('same', 1), event('same', 2), { nope: true }];
  const next = appendListeningEvent(initial, event('same', 0), NOW);
  assert.equal(next.filter((item) => item.id === 'same').length, 1);
  assert.equal(normalizeListeningEvents([event('old', 100 * 24 * 60)], NOW).length, 0);
});

test('empty listening history produces an honest zero-state recap', () => {
  assert.deepEqual(buildWeeklyListeningRecap([], NOW), {
    eventCount: 0,
    uniqueTrackCount: 0,
    creditedMinutes: 0,
    discoveryPercent: 0,
    longestSessionMinutes: 0,
    topArtists: [],
    topSource: null,
  });
});
