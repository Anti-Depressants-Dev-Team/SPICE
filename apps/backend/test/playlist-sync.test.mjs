import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isUuid,
  playlistItemsMatch,
  playlistMetadataMatches,
  playlistMetadataValues,
} from '../lib/playlist-sync.ts';

const id = 'f3f6279d-5ab8-4aa8-b365-1c9553ce1111';

test('playlist sync recognizes unchanged metadata and track snapshots', () => {
  const input = {
    id,
    title: 'Road trip',
    tracks: [{ id: 'song-1', title: 'Song', artists: [{ name: 'Artist' }], durationMs: 12_345 }],
  };
  const metadata = playlistMetadataValues(input, 0);

  assert.equal(isUuid(id), true);
  assert.equal(playlistMetadataMatches({ ...metadata, deletedAt: null }, input, 0), true);
  assert.equal(playlistItemsMatch([{
    position: 0,
    sourceId: 'youtube_music',
    trackId: 'song-1',
    title: 'Song',
    artistsJson: JSON.stringify([{ id: 'Artist', name: 'Artist' }]),
    artworkUrl: null,
    durationMs: 12_345,
  }], input.tracks), true);
});

test('playlist sync detects metadata, deletion, ordering, and snapshot changes', () => {
  const input = { id, title: 'Road trip', tracks: [{ id: 'song-1' }] };
  const metadata = playlistMetadataValues(input, 0);
  const item = {
    position: 0,
    sourceId: 'youtube_music',
    trackId: 'song-1',
    title: 'Track',
    artistsJson: '[]',
    artworkUrl: null,
    durationMs: null,
  };

  assert.equal(playlistMetadataMatches({ ...metadata, deletedAt: new Date() }, input, 0), false);
  assert.equal(playlistMetadataMatches({ ...metadata, deletedAt: null }, input, 1), false);
  assert.equal(playlistItemsMatch([{ ...item, trackId: 'song-2' }], input.tracks), false);
  assert.equal(playlistItemsMatch([item], [...input.tracks, { id: 'song-2' }]), false);
  assert.equal(isUuid('local-playlist'), false);
});
