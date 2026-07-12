import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compactPlaybackQueueWindow,
  computePlaylistWindow,
  MAX_REMEMBERED_PLAYBACK_QUEUE_ITEMS,
} from '../app/playlist-performance.ts';

const ROW_HEIGHT = 72;
const VIEWPORT_HEIGHT = ROW_HEIGHT * 10;
const TRACK_COUNT = 802;

test('computePlaylistWindow returns an empty window for an empty playlist', () => {
  assert.deepEqual(computePlaylistWindow({
    itemCount: 0,
    scrollOffset: 0,
    viewportHeight: VIEWPORT_HEIGHT,
    rowHeight: ROW_HEIGHT,
    overscan: 5,
  }), {
    startIndex: 0,
    endIndex: 0,
    renderedCount: 0,
    paddingStart: 0,
    paddingEnd: 0,
    totalHeight: 0,
  });
});

test('computePlaylistWindow bounds the first rows of an 802-track playlist', () => {
  const window = computePlaylistWindow({
    itemCount: TRACK_COUNT,
    scrollOffset: 0,
    viewportHeight: VIEWPORT_HEIGHT,
    rowHeight: ROW_HEIGHT,
    overscan: 5,
  });

  assert.deepEqual(window, {
    startIndex: 0,
    endIndex: 15,
    renderedCount: 15,
    paddingStart: 0,
    paddingEnd: 787 * ROW_HEIGHT,
    totalHeight: TRACK_COUNT * ROW_HEIGHT,
  });
});

test('computePlaylistWindow renders only a bounded middle slice', () => {
  const window = computePlaylistWindow({
    itemCount: TRACK_COUNT,
    scrollOffset: 400 * ROW_HEIGHT,
    viewportHeight: VIEWPORT_HEIGHT,
    rowHeight: ROW_HEIGHT,
    overscan: 5,
  });

  assert.deepEqual(window, {
    startIndex: 395,
    endIndex: 415,
    renderedCount: 20,
    paddingStart: 395 * ROW_HEIGHT,
    paddingEnd: 387 * ROW_HEIGHT,
    totalHeight: TRACK_COUNT * ROW_HEIGHT,
  });
});

test('computePlaylistWindow clamps excessive scrolling to the final rows', () => {
  const window = computePlaylistWindow({
    itemCount: TRACK_COUNT,
    scrollOffset: Number.MAX_SAFE_INTEGER,
    viewportHeight: VIEWPORT_HEIGHT,
    rowHeight: ROW_HEIGHT,
    overscan: 5,
  });

  assert.deepEqual(window, {
    startIndex: 787,
    endIndex: 802,
    renderedCount: 15,
    paddingStart: 787 * ROW_HEIGHT,
    paddingEnd: 0,
    totalHeight: TRACK_COUNT * ROW_HEIGHT,
  });
});

test('computePlaylistWindow normalizes invalid bounds safely', () => {
  const window = computePlaylistWindow({
    itemCount: 3.9,
    scrollOffset: -500,
    viewportHeight: 0,
    rowHeight: 0,
    overscan: -2,
  });

  assert.deepEqual(window, {
    startIndex: 0,
    endIndex: 1,
    renderedCount: 1,
    paddingStart: 0,
    paddingEnd: 144,
    totalHeight: 216,
  });
});

test('compactPlaybackQueueWindow handles an empty queue', () => {
  assert.deepEqual(compactPlaybackQueueWindow([], 10), {
    queue: [],
    queueIndex: 0,
    droppedBefore: 0,
    droppedAfter: 0,
  });
});

test('compactPlaybackQueueWindow preserves an active item near the start', () => {
  const queue = Array.from({ length: TRACK_COUNT }, (_, index) => `track-${index}`);
  const compacted = compactPlaybackQueueWindow(queue, 2);

  assert.equal(compacted.queue.length, MAX_REMEMBERED_PLAYBACK_QUEUE_ITEMS);
  assert.equal(compacted.queueIndex, 2);
  assert.equal(compacted.queue[compacted.queueIndex], queue[2]);
  assert.equal(compacted.droppedBefore, 0);
  assert.equal(compacted.droppedAfter, 602);
});

test('compactPlaybackQueueWindow centers an active item in the middle', () => {
  const queue = Array.from({ length: TRACK_COUNT }, (_, index) => ({ id: index }));
  const compacted = compactPlaybackQueueWindow(queue, 401);

  assert.equal(compacted.queue.length, MAX_REMEMBERED_PLAYBACK_QUEUE_ITEMS);
  assert.equal(compacted.queueIndex, 99);
  assert.equal(compacted.queue[compacted.queueIndex], queue[401]);
  assert.equal(compacted.droppedBefore, 302);
  assert.equal(compacted.droppedAfter, 300);
});

test('compactPlaybackQueueWindow preserves an active item at the end', () => {
  const queue = Array.from({ length: TRACK_COUNT }, (_, index) => `track-${index}`);
  const compacted = compactPlaybackQueueWindow(queue, TRACK_COUNT - 1);

  assert.equal(compacted.queue.length, MAX_REMEMBERED_PLAYBACK_QUEUE_ITEMS);
  assert.equal(compacted.queueIndex, MAX_REMEMBERED_PLAYBACK_QUEUE_ITEMS - 1);
  assert.equal(compacted.queue[compacted.queueIndex], queue.at(-1));
  assert.equal(compacted.droppedBefore, 602);
  assert.equal(compacted.droppedAfter, 0);
});

test('compactPlaybackQueueWindow clamps indices and one-item bounds', () => {
  const queue = ['a', 'b', 'c', 'd'];

  const beforeStart = compactPlaybackQueueWindow(queue, -100, 1);
  assert.deepEqual(beforeStart, {
    queue: ['a'],
    queueIndex: 0,
    droppedBefore: 0,
    droppedAfter: 3,
  });

  const afterEnd = compactPlaybackQueueWindow(queue, 100, 1);
  assert.deepEqual(afterEnd, {
    queue: ['d'],
    queueIndex: 0,
    droppedBefore: 3,
    droppedAfter: 0,
  });
});
