import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCrossfadePlan,
  crossfadeGains,
  crossfadeStateAt,
  MAX_CROSSFADE_DURATION_MS,
} from '../app/crossfade.ts';

test('createCrossfadePlan schedules preload and fade relative to track end', () => {
  assert.deepEqual(createCrossfadePlan({
    trackDurationMs: 60_000,
    crossfadeDurationMs: 10_000,
    preloadLeadMs: 5_000,
  }), {
    enabled: true,
    trackDurationMs: 60_000,
    requestedDurationMs: 10_000,
    durationMs: 10_000,
    preloadAtMs: 45_000,
    fadeStartMs: 50_000,
    endAtMs: 60_000,
  });
});

test('createCrossfadePlan caps fades for short tracks and maximum settings', () => {
  const plan = createCrossfadePlan({
    trackDurationMs: 10_000,
    crossfadeDurationMs: MAX_CROSSFADE_DURATION_MS * 4,
  });

  assert.equal(plan.requestedDurationMs, MAX_CROSSFADE_DURATION_MS);
  assert.equal(plan.durationMs, 5_000);
  assert.equal(plan.fadeStartMs, 5_000);
  assert.equal(plan.preloadAtMs, 0);
});

test('crossfadeStateAt returns idle, preload, fading, and complete phases', () => {
  const plan = createCrossfadePlan({
    trackDurationMs: 60_000,
    crossfadeDurationMs: 10_000,
    preloadLeadMs: 5_000,
  });

  assert.deepEqual(crossfadeStateAt(plan, 44_000), {
    phase: 'idle',
    progress: 0,
    positionMs: 44_000,
    timeUntilFadeMs: 6_000,
    shouldPreload: false,
  });
  assert.equal(crossfadeStateAt(plan, 45_000).phase, 'preload');
  assert.deepEqual(crossfadeStateAt(plan, 55_000), {
    phase: 'fading',
    progress: 0.5,
    positionMs: 55_000,
    timeUntilFadeMs: 0,
    shouldPreload: true,
  });
  assert.deepEqual(crossfadeStateAt(plan, 90_000), {
    phase: 'complete',
    progress: 1,
    positionMs: 60_000,
    timeUntilFadeMs: 0,
    shouldPreload: true,
  });
});

test('disabled and invalid plans do not start preloading or fading', () => {
  const plan = createCrossfadePlan({
    trackDurationMs: Number.NaN,
    crossfadeDurationMs: -1_000,
  });

  assert.equal(plan.enabled, false);
  assert.equal(plan.durationMs, 0);
  assert.deepEqual(crossfadeStateAt(plan, 5_000), {
    phase: 'idle',
    progress: 0,
    positionMs: 0,
    timeUntilFadeMs: 0,
    shouldPreload: false,
  });

  const disabled = createCrossfadePlan({
    trackDurationMs: 60_000,
    crossfadeDurationMs: 0,
  });
  assert.equal(crossfadeStateAt(disabled, 60_000).shouldPreload, false);
});

test('crossfadeGains supports clamped linear and equal-power envelopes', () => {
  assert.deepEqual(crossfadeGains(-5, 'linear'), { outgoing: 1, incoming: 0 });
  assert.deepEqual(crossfadeGains(0.25, 'linear'), { outgoing: 0.75, incoming: 0.25 });
  assert.deepEqual(crossfadeGains(5, 'linear'), { outgoing: 0, incoming: 1 });

  const midpoint = crossfadeGains(0.5, 'equal-power');
  assert.ok(Math.abs(midpoint.outgoing - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(midpoint.incoming - Math.SQRT1_2) < 1e-12);
});
