const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DesktopSleepTimer,
  detectDesktopPlaybackBoundary,
  formatDesktopSleepTimer,
  normalizeDesktopSleepTimer,
} = require("../desktop-sleep-timer");

test("desktop sleep timer schedules and expires a duration once", () => {
  let now = 1_000;
  let callback = null;
  let delay = null;
  let expirations = 0;
  const timer = new DesktopSleepTimer({
    now: () => now,
    setTimer: (next, nextDelay) => { callback = next; delay = nextDelay; return 1; },
    clearTimer: () => {},
    onExpire: () => { expirations += 1; },
  });

  timer.setDuration(15);
  assert.equal(delay, 15 * 60_000);
  now += delay;
  callback();
  assert.equal(expirations, 1);
  assert.deepEqual(timer.snapshot(), { mode: "off" });
});

test("desktop sleep timer supports track and queue boundaries", () => {
  let expirations = 0;
  const timer = new DesktopSleepTimer({ onExpire: () => { expirations += 1; } });
  timer.setEndOfQueue();
  assert.equal(timer.handleTrackEnd({ queueEnded: false }), false);
  assert.equal(timer.handleTrackEnd({ queueEnded: true }), true);
  timer.setEndOfTrack();
  assert.equal(timer.handleTrackEnd(), true);
  assert.equal(expirations, 2);
  timer.dispose();
});

test("desktop sleep timer rejects stale persisted deadlines and formats active ones", () => {
  assert.deepEqual(normalizeDesktopSleepTimer({ mode: "duration", expiresAt: 999 }, 1_000), { mode: "off" });
  assert.equal(formatDesktopSleepTimer({ mode: "duration", expiresAt: 62_000 }, 1_000), "1:01");
});

test("desktop playback boundaries distinguish progress, track changes, repeats, and queue tails", () => {
  const playing = { trackKey: "artist - one", currentTime: 42, duration: 180, paused: false, queueAtTail: false };
  assert.deepEqual(detectDesktopPlaybackBoundary(playing, { ...playing, currentTime: 43 }), {
    trackEnded: false,
    queueEnded: false,
  });
  assert.deepEqual(detectDesktopPlaybackBoundary(playing, { ...playing, trackKey: "artist - two", currentTime: 0 }), {
    trackEnded: true,
    queueEnded: false,
  });
  assert.equal(detectDesktopPlaybackBoundary({ ...playing, queueAtTail: true }, { ...playing, currentTime: 0 }).queueEnded, true);
  assert.equal(detectDesktopPlaybackBoundary(
    { ...playing, currentTime: 179.5, queueAtTail: true },
    { ...playing, currentTime: 180, paused: true },
  ).queueEnded, true);
});
