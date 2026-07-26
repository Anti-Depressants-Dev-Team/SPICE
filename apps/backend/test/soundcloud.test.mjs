import assert from 'node:assert/strict';
import test from 'node:test';

import {
  expandSoundCloudShortUrl,
  stripSoundCloudTrackPrefix,
} from '../lib/soundcloud.ts';

test('stripSoundCloudTrackPrefix correctly strips prefix', () => {
  assert.equal(stripSoundCloudTrackPrefix('soundcloud:12345'), '12345');
});

test('stripSoundCloudTrackPrefix returns original string if prefix is not present', () => {
  assert.equal(stripSoundCloudTrackPrefix('spotify:12345'), 'spotify:12345');
  assert.equal(stripSoundCloudTrackPrefix('12345'), '12345');
});

test('stripSoundCloudTrackPrefix handles empty strings', () => {
  assert.equal(stripSoundCloudTrackPrefix(''), '');
});

test('SoundCloud short links are expanded only to a verified SoundCloud page', async () => {
  let requestMethod = '';
  let bodyCancelled = false;
  const expanded = await expandSoundCloudShortUrl(
    'https://on.soundcloud.com/AbCd12',
    async (_url, options) => {
      requestMethod = options.method;
      return {
        ok: true,
        status: 200,
        url: 'https://soundcloud.com/artist/track-name?si=tracking',
        headers: new Headers(),
        body: {
          cancel: async () => {
            bodyCancelled = true;
          },
        },
      };
    },
  );

  assert.equal(requestMethod, 'HEAD');
  assert.equal(expanded.hostname, 'soundcloud.com');
  assert.equal(expanded.pathname, '/artist/track-name');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(bodyCancelled, true);
});

test('SoundCloud short links reject a redirect outside SoundCloud', async () => {
  await assert.rejects(
    expandSoundCloudShortUrl(
      'https://on.soundcloud.com/AbCd12',
      async () => ({
        ok: true,
        status: 200,
        url: 'https://attacker.example/track',
        headers: new Headers(),
        body: null,
      }),
    ),
    /unsupported or unavailable page/,
  );
});

test('SoundCloud short-link expansion never follows a hostile redirect', async () => {
  const requests = [];
  await assert.rejects(
    expandSoundCloudShortUrl(
      'https://on.soundcloud.com/AbCd12',
      async (url, options) => {
        requests.push([url.toString(), options.redirect]);
        return {
          ok: false,
          status: 302,
          url: url.toString(),
          headers: new Headers({ location: 'https://attacker.example/internal' }),
          body: null,
        };
      },
    ),
    /unsupported or unavailable page/,
  );
  assert.deepEqual(requests, [['https://on.soundcloud.com/AbCd12', 'manual']]);
});
