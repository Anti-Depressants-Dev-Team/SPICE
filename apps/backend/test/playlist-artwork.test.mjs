import assert from 'node:assert/strict';
import test from 'node:test';

import { playlistArtworkCandidates } from '../app/playlist-artwork.ts';

test('playlist artwork prefers a custom cover and keeps track fallbacks', () => {
  assert.deepEqual(
    playlistArtworkCandidates({
      coverUrl: ' https://example.com/custom.jpg ',
      tracks: [{
        id: 'dQw4w9WgXcQ',
        sourceId: 'youtube_music',
        artworkUrl: 'https://example.com/track.jpg',
      }],
    }),
    [
      'https://example.com/custom.jpg',
      'https://example.com/track.jpg',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    ],
  );
});

test('playlist artwork recovers a YouTube thumbnail when saved artwork is missing', () => {
  assert.deepEqual(
    playlistArtworkCandidates({ tracks: [{ id: 'dQw4w9WgXcQ', sourceId: 'youtube_video' }] }),
    ['https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'],
  );
});

test('playlist artwork ignores blank, duplicate, and unsafe derived candidates', () => {
  assert.deepEqual(
    playlistArtworkCandidates({
      coverUrl: ' ',
      tracks: [
        { id: 'not-a-video-id', sourceId: 'youtube_music' },
        { id: 'dQw4w9WgXcQ', sourceId: 'soundcloud', artworkUrl: 'https://example.com/art.jpg' },
        { artworkUrl: 'https://example.com/art.jpg' },
      ],
    }),
    ['https://example.com/art.jpg'],
  );
});
