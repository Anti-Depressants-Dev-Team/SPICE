const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildActivity,
  shouldRefreshPresence,
  snapshotTrack,
} = require('../discord-rpc');

test('Discord activity uses track art, a public SPICE button, and anchored timestamps', () => {
  const activity = buildActivity({
    id: 'song-1',
    title: 'Night Drive',
    artist: 'Test Artist',
    album: 'Midnight',
    albumArt: 'https://cdn.example.com/cover.jpg',
    listenUrl: 'https://music.spice-app.xyz/?song=abc123',
    service: 'spice_crazy',
    paused: false,
    currentTime: 20,
    duration: 200,
  }, 100_000);

  assert.equal(activity.largeImageKey, 'https://cdn.example.com/cover.jpg');
  assert.equal(activity.largeImageUrl, 'https://music.spice-app.xyz/?song=abc123');
  assert.deepEqual(activity.buttons, [{
    label: 'Listen on SPICE',
    url: 'https://music.spice-app.xyz/?song=abc123',
  }]);
  assert.equal(activity.startTimestamp, 80_000);
  assert.equal(activity.endTimestamp, 280_000);
});

test('Discord activity offers the installer when a public song link is unavailable', () => {
  const activity = buildActivity({
    title: 'External Track',
    artist: 'Artist',
    albumArt: 'file:///private/cover.jpg',
    service: 'sc',
    paused: true,
  }, 100_000);

  assert.equal(activity.largeImageKey, 'spice');
  assert.deepEqual(activity.buttons, [{
    label: 'Download SPICE',
    url: 'https://install.spice-app.xyz/',
  }]);
  assert.equal(activity.startTimestamp, undefined);
  assert.equal(activity.endTimestamp, undefined);
});

test('continuous playback does not spam Discord but seeks, repeats, and pauses refresh it', () => {
  const base = {
    id: 'song-1',
    title: 'Night Drive',
    artist: 'Test Artist',
    service: 'spice_crazy',
    paused: false,
    currentTime: 10,
    duration: 200,
  };
  const previous = snapshotTrack(base, 1_000);

  assert.equal(shouldRefreshPresence(previous, { ...base, currentTime: 14.1 }, 5_100), false);
  assert.equal(shouldRefreshPresence(previous, { ...base, currentTime: 40 }, 5_100), true);
  assert.equal(shouldRefreshPresence(previous, { ...base, currentTime: 0 }, 190_000), true);
  assert.equal(shouldRefreshPresence(previous, { ...base, paused: true, currentTime: 14 }, 5_100), true);
});
