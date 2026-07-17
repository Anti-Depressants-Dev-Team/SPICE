import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptiveTrackWeight,
  adaptiveTrackWeights,
  classifyAdaptiveListen,
  normalizeAdaptiveTrackPriorityState,
  recordAdaptiveListenOutcome,
  shouldTreatAdaptiveSeekAsSkip,
} from '../app/adaptive-track-priority.ts';

test('completed listens raise priority while early skips lower it persistently', () => {
  let state = normalizeAdaptiveTrackPriorityState(null);
  state = recordAdaptiveListenOutcome(state, 'youtube_music:liked', 'completed', 1_000);
  state = recordAdaptiveListenOutcome(state, 'youtube_music:liked', 'completed', 2_000);
  state = recordAdaptiveListenOutcome(state, 'youtube_music:skipped', 'skipped', 3_000);

  assert.deepEqual(state.tracks['youtube_music:liked'], {
    score: 2,
    completed: 2,
    skipped: 0,
    updatedAt: 2_000,
  });
  assert.equal(state.tracks['youtube_music:skipped'].score, -1);
  assert.ok(adaptiveTrackWeight(state, 'youtube_music:liked') > 1);
  assert.ok(adaptiveTrackWeight(state, 'youtube_music:skipped') < 1);

  const restored = normalizeAdaptiveTrackPriorityState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(adaptiveTrackWeights(restored, [
    'youtube_music:liked',
    'youtube_music:unknown',
    'youtube_music:skipped',
  ]), [adaptiveTrackWeight(state, 'youtube_music:liked'), 1, adaptiveTrackWeight(state, 'youtube_music:skipped')]);
});

test('only a natural completion earns priority; every explicit exit is a skip', () => {
  assert.equal(classifyAdaptiveListen({
    completedNaturally: true,
  }), 'completed');
  assert.equal(classifyAdaptiveListen({
    completedNaturally: false,
  }), 'skipped');
});

test('seeking across the end cannot manufacture a completed listen', () => {
  assert.equal(shouldTreatAdaptiveSeekAsSkip({
    positionMs: 10_000,
    seekPositionMs: 178_000,
    durationMs: 180_000,
  }), true);
  assert.equal(shouldTreatAdaptiveSeekAsSkip({
    positionMs: 10_000,
    seekPositionMs: 90_000,
    durationMs: 180_000,
  }), false);
  assert.equal(shouldTreatAdaptiveSeekAsSkip({
    positionMs: 178_000,
    seekPositionMs: 10_000,
    durationMs: 180_000,
  }), false);
  assert.equal(shouldTreatAdaptiveSeekAsSkip({
    positionMs: 0,
    seekPositionMs: 10_000,
    durationMs: 0,
  }), false);
});

test('stored priority data is bounded and malformed entries are ignored', () => {
  const state = normalizeAdaptiveTrackPriorityState({
    version: 999,
    tracks: {
      valid: { score: 999, completed: -2, skipped: 4.8, updatedAt: 50 },
      broken: null,
      constructor: { score: 3, completed: 1, skipped: 0, updatedAt: 60 },
    },
  });

  assert.deepEqual(state, {
    version: 1,
    tracks: {
      valid: { score: 8, completed: 0, skipped: 4, updatedAt: 50 },
    },
  });
  assert.equal(adaptiveTrackWeight(state, 'valid'), 4);
});
