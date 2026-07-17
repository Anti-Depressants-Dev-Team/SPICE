import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findPlaylistTrackPosition,
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

test('shared playlist additions identify an existing source and track pair', () => {
  const items = [
    { position: 2, sourceId: 'youtube_music', trackId: 'same-id' },
    { position: 4, sourceId: 'soundcloud', trackId: 'same-id' },
  ];

  assert.equal(findPlaylistTrackPosition(items, { id: 'same-id' }), 2);
  assert.equal(findPlaylistTrackPosition(items, { id: 'same-id', sourceId: 'soundcloud' }), 4);
  assert.equal(findPlaylistTrackPosition(items, { id: 'new-id', sourceId: 'soundcloud' }), null);
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

test('private playlist sync preserves intentional repeated track positions', () => {
  const repeatedTrack = { id: 'song-1', title: 'Repeat me' };
  const storedItem = {
    sourceId: 'youtube_music',
    trackId: 'song-1',
    title: 'Repeat me',
    artistsJson: '[]',
    artworkUrl: null,
    durationMs: null,
  };

  assert.equal(playlistItemsMatch([
    { ...storedItem, position: 0 },
    { ...storedItem, position: 1 },
  ], [repeatedTrack, repeatedTrack]), true);
});
