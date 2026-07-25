import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSupportedMediaLink } from '../lib/media-link.ts';

test('parses YouTube videos, shorts, and playlists pasted into search', () => {
  assert.deepEqual(
    parseSupportedMediaLink('https://youtu.be/dQw4w9WgXcQ?t=4'),
    {
      provider: 'youtube',
      kind: 'track',
      id: 'dQw4w9WgXcQ',
      url: 'https://youtu.be/dQw4w9WgXcQ?t=4',
    },
  );
  assert.equal(
    parseSupportedMediaLink('https://www.youtube.com/shorts/dQw4w9WgXcQ')?.id,
    'dQw4w9WgXcQ',
  );
  assert.deepEqual(
    parseSupportedMediaLink('https://music.youtube.com/playlist?list=PL1234567890'),
    {
      provider: 'youtube',
      kind: 'playlist',
      id: 'PL1234567890',
      url: 'https://music.youtube.com/playlist?list=PL1234567890',
    },
  );
});

test('parses SoundCloud links and rejects lookalike or unsupported URLs', () => {
  assert.deepEqual(
    parseSupportedMediaLink('https://soundcloud.com/artist/track-name'),
    {
      provider: 'soundcloud',
      kind: 'url',
      url: 'https://soundcloud.com/artist/track-name',
    },
  );
  assert.equal(parseSupportedMediaLink('https://soundcloud.com.attacker.test/artist/track'), null);
  assert.equal(parseSupportedMediaLink('http://soundcloud.com/artist/track-name'), null);
  assert.equal(parseSupportedMediaLink('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseSupportedMediaLink('not a url'), null);
});
