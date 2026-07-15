import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDurationSleepTimer,
  formatSleepTimer,
  normalizeSleepTimer,
  shouldStopForSleepTimer,
} from '../app/sleep-timer.ts';

test('duration sleep timers persist deadlines and expire after restart', () => {
  const timer = createDurationSleepTimer(30, 1_000);
  assert.deepEqual(timer, { mode: 'duration', expiresAt: 1_801_000 });
  assert.equal(formatSleepTimer(timer, 1_000), '30:00');
  assert.equal(shouldStopForSleepTimer({ timer, now: 1_800_999 }), false);
  assert.equal(shouldStopForSleepTimer({ timer, now: 1_801_000 }), true);
  assert.deepEqual(normalizeSleepTimer(timer, 1_801_001), { mode: 'off' });
});

test('end-of-track timer is bound to the track that was armed', () => {
  const timer = normalizeSleepTimer({ mode: 'end-track', armedTrackKey: 'soundcloud:one' });
  assert.equal(shouldStopForSleepTimer({ timer, event: 'track-ended', trackKey: 'youtube_music:one' }), false);
  assert.equal(shouldStopForSleepTimer({ timer, event: 'track-ended', trackKey: 'soundcloud:one' }), true);
});

test('end-of-queue timer only stops at a real queue tail', () => {
  const timer = normalizeSleepTimer({ mode: 'end-queue' });
  assert.equal(shouldStopForSleepTimer({ timer, event: 'track-ended', isQueueTail: false }), false);
  assert.equal(shouldStopForSleepTimer({ timer, event: 'track-ended', isQueueTail: true }), true);
});
