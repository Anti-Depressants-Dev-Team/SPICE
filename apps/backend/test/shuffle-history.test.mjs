import assert from 'node:assert/strict';
import test from 'node:test';

import {
  alignShuffleHistory,
  MAX_SHUFFLE_HISTORY_ENTRIES,
  nextShuffleTrack,
  previousShuffleTrack,
  resetShuffleHistory,
} from '../app/shuffle-history.ts';

const queue = ['track:a', 'track:b', 'track:c', 'track:d'];

test('shuffle previous and next traverse the songs already heard in order', () => {
  let state = resetShuffleHistory(queue, 0);

  const firstNext = nextShuffleTrack(state, queue, 0, { random: () => 0 });
  assert.equal(firstNext.index, 1);
  state = firstNext.state;

  const secondNext = nextShuffleTrack(state, queue, 1, { random: () => 0 });
  assert.equal(secondNext.index, 2);
  state = secondNext.state;

  const previous = previousShuffleTrack(state, queue, 2);
  assert.equal(previous.index, 1);
  state = previous.state;

  const forwardAgain = nextShuffleTrack(state, queue, 1, { random: () => 0.99 });
  assert.equal(forwardAgain.index, 2);
  assert.equal(forwardAgain.fromHistory, true);

  const firstUnheardAfterHistory = nextShuffleTrack(forwardAgain.state, queue, 2, { random: () => 0 });
  assert.equal(firstUnheardAfterHistory.index, 3);
  assert.equal(firstUnheardAfterHistory.fromHistory, false);
});

test('adaptive weights affect only new shuffle choices, never backward or forward history', () => {
  const weights = [1, 1, 8, 1];
  const firstNext = nextShuffleTrack(resetShuffleHistory(queue, 0), queue, 0, {
    random: () => 0.15,
    weights,
  });
  assert.equal(firstNext.index, 2);
  assert.equal(firstNext.fromHistory, false);

  const secondNext = nextShuffleTrack(firstNext.state, queue, 2, {
    random: () => 0.99,
    weights,
  });
  assert.equal(secondNext.index, 3);

  const previous = previousShuffleTrack(secondNext.state, queue, 3);
  assert.equal(previous.index, 2);

  const forwardAgain = nextShuffleTrack(previous.state, queue, 2, {
    random: () => 0,
    weights: [100, 100, 1, 0.001],
  });
  assert.equal(forwardAgain.index, 3);
  assert.equal(forwardAgain.fromHistory, true);
});

test('adaptive shuffle safely bounds malformed and extreme weights', () => {
  const result = nextShuffleTrack(resetShuffleHistory(queue, 0), queue, 0, {
    random: () => Number.NaN,
    weights: [1, Number.POSITIVE_INFINITY, Number.MAX_VALUE, -4],
  });

  assert.equal(result.index, 1);
  assert.equal(result.fromHistory, false);
});

test('adaptive priorities change long-run frequency without immediate repeats', () => {
  const adaptiveQueue = ['neutral:a', 'favorite', 'skipped', 'neutral:b', 'neutral:c'];
  const weights = [1, 4, 0.25, 1, 1];
  const counts = [1, 0, 0, 0, 0];
  let state = resetShuffleHistory(adaptiveQueue, 0);
  let currentIndex = 0;
  let seed = 123_456;
  const random = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 4_294_967_296;
  };

  for (let step = 0; step < 4_000; step += 1) {
    const next = nextShuffleTrack(state, adaptiveQueue, currentIndex, {
      random,
      weights,
      wrap: true,
    });
    assert.notEqual(next.index, null);
    assert.notEqual(next.index, currentIndex);
    currentIndex = next.index;
    counts[currentIndex] += 1;
    state = next.state;
  }

  assert.ok(counts[1] > counts[0] * 1.8, `favorite count ${counts[1]} should exceed neutral ${counts[0]}`);
  assert.ok(counts[0] > counts[2] * 2.5, `neutral count ${counts[0]} should exceed skipped ${counts[2]}`);
});

test('fresh shuffle avoids an identical duplicate track when a distinct song exists', () => {
  const duplicateQueue = ['same', 'same', 'different'];
  const next = nextShuffleTrack(resetShuffleHistory(duplicateQueue, 0), duplicateQueue, 0, {
    random: () => 0,
    weights: [4, 4, 0.25],
  });
  assert.equal(next.index, 2);
});

test('weighted rounds keep queue-sized repeat-none budgets and bounded exact history', () => {
  const weights = [1, 8, 0.25, 1];
  let state = resetShuffleHistory(queue, 0);
  let currentIndex = 0;

  for (let step = 0; step < queue.length - 1; step += 1) {
    const next = nextShuffleTrack(state, queue, currentIndex, {
      random: () => 0.2,
      weights,
    });
    assert.notEqual(next.index, null);
    currentIndex = next.index;
    state = next.state;
  }
  assert.equal(nextShuffleTrack(state, queue, currentIndex, { weights }).index, null);

  for (let step = 0; step < MAX_SHUFFLE_HISTORY_ENTRIES + 250; step += 1) {
    const next = nextShuffleTrack(state, queue, currentIndex, {
      random: () => 0.7,
      weights,
      wrap: true,
    });
    assert.notEqual(next.index, null);
    currentIndex = next.index;
    state = next.state;
  }
  assert.equal(state.sequence.length, MAX_SHUFFLE_HISTORY_ENTRIES);
  assert.equal(state.cursor, state.sequence.length - 1);
  assert.equal(state.sequence[state.cursor], currentIndex);
  const previous = previousShuffleTrack(state, queue, currentIndex);
  assert.equal(previous.index, state.sequence[state.cursor - 1]);
});

test('shuffle does not repeat a queue entry before the cycle is exhausted', () => {
  let state = resetShuffleHistory(queue, 0);
  const played = [0];

  for (let step = 0; step < queue.length - 1; step += 1) {
    const next = nextShuffleTrack(state, queue, played.at(-1), { random: () => 0 });
    assert.notEqual(next.index, null);
    played.push(next.index);
    state = next.state;
  }

  assert.deepEqual(played, [0, 1, 2, 3]);
  assert.equal(nextShuffleTrack(state, queue, 3, { random: () => 0 }).index, null);

  const wrapped = nextShuffleTrack(state, queue, 3, { random: () => 0, wrap: true });
  assert.equal(wrapped.index, 0);
});

test('appending tracks keeps shuffle history while replacing a queue resets it', () => {
  const firstNext = nextShuffleTrack(resetShuffleHistory(queue, 0), queue, 0, { random: () => 0 });
  const extendedQueue = [...queue, 'track:e'];
  const alignedExtension = alignShuffleHistory(firstNext.state, extendedQueue, 1);

  assert.deepEqual(alignedExtension.sequence, [0, 1]);
  assert.deepEqual(alignedExtension.queueKeys, extendedQueue);

  const replacement = ['track:x', 'track:y'];
  const reset = alignShuffleHistory(alignedExtension, replacement, 1);
  assert.deepEqual(reset.sequence, [1]);
  assert.deepEqual(reset.cycleVisited, [1]);
});
