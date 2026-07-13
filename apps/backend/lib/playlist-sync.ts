import type { TrackSnapshotInput } from './track-snapshot.ts';
import { trackSnapshotColumns } from './track-snapshot.ts';

export const DEFAULT_PLAYLIST_GRADIENT = 'linear-gradient(135deg, #a855f7, #ec4899)';

export interface PlaylistSyncInput {
  id?: string;
  title?: string;
  description?: string;
  gradient?: string;
  coverUrl?: string;
  tracks?: TrackSnapshotInput[];
  isPublic?: boolean;
}

interface StoredPlaylist {
  title: string;
  description: string | null;
  gradient: string;
  coverUrl: string | null;
  sortIndex: number;
  isPublic: boolean;
  deletedAt: Date | null;
}

interface StoredPlaylistItem {
  position: number;
  sourceId: string;
  trackId: string;
  title: string;
  artistsJson: string;
  artworkUrl: string | null;
  durationMs: number | null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function playlistMetadataValues(input: PlaylistSyncInput, sortIndex: number) {
  return {
    title: input.title || 'Untitled Playlist',
    description: input.description || '',
    gradient: input.gradient || DEFAULT_PLAYLIST_GRADIENT,
    coverUrl: input.coverUrl || null,
    sortIndex,
    isPublic: input.isPublic !== false,
  };
}

export function playlistMetadataMatches(
  stored: StoredPlaylist,
  input: PlaylistSyncInput,
  sortIndex: number,
) {
  const expected = playlistMetadataValues(input, sortIndex);
  return stored.deletedAt === null
    && stored.title === expected.title
    && (stored.description || '') === expected.description
    && stored.gradient === expected.gradient
    && stored.coverUrl === expected.coverUrl
    && stored.sortIndex === expected.sortIndex
    && stored.isPublic === expected.isPublic;
}

export function playlistItemsMatch(
  storedItems: StoredPlaylistItem[],
  tracks: TrackSnapshotInput[] | undefined,
) {
  const expectedTracks = Array.isArray(tracks) ? tracks : [];
  if (storedItems.length !== expectedTracks.length) return false;

  const orderedItems = [...storedItems].sort((a, b) => a.position - b.position);
  return expectedTracks.every((track, position) => {
    const stored = orderedItems[position];
    const snapshot = trackSnapshotColumns(track, track.id);
    return stored.position === position
      && stored.sourceId === (track.sourceId || 'youtube_music')
      && stored.trackId === track.id
      && stored.title === snapshot.title
      && stored.artistsJson === snapshot.artistsJson
      && stored.artworkUrl === snapshot.artworkUrl
      && stored.durationMs === snapshot.durationMs;
  });
}
