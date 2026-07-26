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
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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

test('normalizes mobile, embedded, tracking, schemeless, and redirect YouTube links', () => {
  assert.deepEqual(
    parseSupportedMediaLink('m.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=chat&si=tracking'),
    {
      provider: 'youtube',
      kind: 'track',
      id: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  );
  assert.equal(
    parseSupportedMediaLink('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=20')?.id,
    'dQw4w9WgXcQ',
  );
  assert.deepEqual(
    parseSupportedMediaLink(
      'https://www.youtube.com/redirect?q=https%3A%2F%2Fmusic.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ%26si%3Dtracking',
    ),
    {
      provider: 'youtube',
      kind: 'track',
      id: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  );
});

test('parses YouTube Music album browse links separately from playlists', () => {
  assert.deepEqual(
    parseSupportedMediaLink('https://music.youtube.com/browse/MPREb_example123?si=tracking'),
    {
      provider: 'youtube',
      kind: 'album',
      id: 'MPREb_example123',
      url: 'https://music.youtube.com/browse/MPREb_example123',
    },
  );
});

test('parses SoundCloud links and rejects lookalike or unsupported URLs', () => {
  assert.deepEqual(
    parseSupportedMediaLink('https://m.soundcloud.com/artist/track-name?utm_source=clipboard'),
    {
      provider: 'soundcloud',
      kind: 'url',
      url: 'https://soundcloud.com/artist/track-name',
    },
  );
  assert.deepEqual(
    parseSupportedMediaLink('on.soundcloud.com/AbCd12?si=tracking'),
    {
      provider: 'soundcloud',
      kind: 'url',
      url: 'https://on.soundcloud.com/AbCd12',
    },
  );
  assert.equal(parseSupportedMediaLink('https://soundcloud.com.attacker.test/artist/track'), null);
  assert.equal(parseSupportedMediaLink('http://soundcloud.com/artist/track-name'), null);
  assert.equal(parseSupportedMediaLink('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseSupportedMediaLink('not a url'), null);
});
