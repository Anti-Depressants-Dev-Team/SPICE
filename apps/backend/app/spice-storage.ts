import { compactPlaybackQueueWindow } from './playlist-performance.ts';

export interface TrackArtistSnapshot {
  id: string;
  name: string;
  artworkUrl?: string;
}

export interface TrackAlbumSnapshot {
  id: string;
  title: string;
  artists: TrackArtistSnapshot[];
  artworkUrl?: string;
  year?: number;
}

export interface TrackSnapshot {
  id: string;
  title: string;
  artists: TrackArtistSnapshot[];
  album?: TrackAlbumSnapshot;
  durationMs?: number;
  artworkUrl?: string;
  sourceId?: string;
  permalinkUrl?: string;
  previewOnly?: boolean;
  msListened?: number;
}

export interface SearchCacheEntry {
  query: string;
  tracks: TrackSnapshot[];
  savedAt: number;
  sourceId?: string;
}

export interface PlaybackSaveState {
  currentTrack: TrackSnapshot;
  queue: TrackSnapshot[];
  queueIndex: number;
  progress: number;
  repeatMode?: 'none' | 'all' | 'one';
  isShuffle?: boolean;
  volume?: number;
  savedAt: number;
}

interface StoredTrackSnapshot {
  track: TrackSnapshot;
  savedAt: number;
}

interface PlaybackProgressSnapshot {
  trackKey: string;
  progress: number;
  savedAt: number;
}

const TRACK_SNAPSHOTS_KEY = 'spice_track_snapshots_v1';
const SEARCH_CACHE_KEY = 'spice_search_cache_v1';
const PLAYBACK_STATES_KEY = 'spice_playback_states_v1';
const PLAYBACK_PROGRESS_KEY = 'spice_playback_progress_v1';
const MAX_TRACK_SNAPSHOTS = 500;
const MAX_SEARCH_ENTRIES = 12;
const MAX_SEARCH_TRACKS = 30;
const MAX_PLAYBACK_PROFILES = 6;

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function readJson<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not persist ${key}:`, error);
  }
}

function normalizeQuery(query: string) {
  return query.trim().toLocaleLowerCase();
}

function isUsefulTrack(track: TrackSnapshot | undefined): track is TrackSnapshot {
  return !!track && !!track.id && track.id !== 'placeholder';
}

function playbackTrackKey(track: TrackSnapshot) {
  return `${track.sourceId ?? 'unknown'}:${track.id}`;
}

function snapshotScore(track: TrackSnapshot) {
  let score = 0;
  if (track.title && track.title !== 'Track' && track.title !== 'Unknown track') score += 3;
  if (track.artists?.length) score += 2;
  if (track.artworkUrl) score += 3;
  if (track.durationMs) score += 1;
  if (track.album?.title) score += 1;
  return score;
}

// This store is shared by every local profile and exists only to restore
// provider metadata. Listening credit belongs to a profile's history, so it
// must never be carried through this shared cache.
function withoutListenCredit(track: TrackSnapshot): TrackSnapshot {
  const { msListened: _msListened, ...metadata } = track;
  return metadata;
}

export function mergeTrackSnapshots(
  existing: TrackSnapshot | undefined,
  incoming: TrackSnapshot,
): TrackSnapshot {
  if (!existing || existing.id !== incoming.id) return incoming;

  const preferred = snapshotScore(incoming) >= snapshotScore(existing) ? incoming : existing;
  const fallback = preferred === incoming ? existing : incoming;

  return {
    ...fallback,
    ...preferred,
    title: preferred.title && preferred.title !== 'Track' ? preferred.title : fallback.title,
    artists: preferred.artists?.length ? preferred.artists : fallback.artists,
    album: preferred.album ?? fallback.album,
    durationMs: preferred.durationMs ?? fallback.durationMs,
    artworkUrl: preferred.artworkUrl ?? fallback.artworkUrl,
    sourceId: preferred.sourceId ?? fallback.sourceId,
    permalinkUrl: preferred.permalinkUrl ?? fallback.permalinkUrl,
    previewOnly: preferred.previewOnly ?? fallback.previewOnly,
    ...(
      preferred.msListened !== undefined || fallback.msListened !== undefined
        ? { msListened: Math.max(preferred.msListened ?? 0, fallback.msListened ?? 0) }
        : {}
    ),
  };
}

function getTrackSnapshotStore() {
  return readJson<Record<string, StoredTrackSnapshot>>(TRACK_SNAPSHOTS_KEY, {});
}

function enrichTrackSnapshotFromStore(
  track: TrackSnapshot,
  snapshots: Record<string, StoredTrackSnapshot>,
): TrackSnapshot {
  const saved = snapshots[track.id]?.track;
  return saved ? mergeTrackSnapshots(withoutListenCredit(saved), track) : track;
}

function enrichTrackSnapshotsFromStore(
  tracks: TrackSnapshot[],
  snapshots: Record<string, StoredTrackSnapshot>,
): TrackSnapshot[] {
  return tracks.map((track) => enrichTrackSnapshotFromStore(track, snapshots));
}

function trimPlaybackProfiles<T extends { savedAt: number }>(states: Record<string, T>) {
  return Object.fromEntries(
    Object.entries(states)
      .sort(([, a], [, b]) => b.savedAt - a.savedAt)
      .slice(0, MAX_PLAYBACK_PROFILES),
  );
}

export function rememberTrackSnapshots(tracks: TrackSnapshot[]) {
  const snapshots = getTrackSnapshotStore();
  const savedAt = Date.now();

  for (const track of tracks) {
    if (!isUsefulTrack(track)) continue;
    snapshots[track.id] = {
      track: mergeTrackSnapshots(
        snapshots[track.id]?.track
          ? withoutListenCredit(snapshots[track.id].track)
          : undefined,
        withoutListenCredit(track),
      ),
      savedAt,
    };
  }

  const trimmed = Object.fromEntries(
    Object.entries(snapshots)
      .sort(([, a], [, b]) => b.savedAt - a.savedAt)
      .slice(0, MAX_TRACK_SNAPSHOTS),
  );
  writeJson(TRACK_SNAPSHOTS_KEY, trimmed);
}

export function enrichTrackSnapshot(track: TrackSnapshot): TrackSnapshot {
  return enrichTrackSnapshotFromStore(track, getTrackSnapshotStore());
}

export function enrichTrackSnapshots(tracks: TrackSnapshot[]): TrackSnapshot[] {
  if (tracks.length === 0) return [];

  const snapshots = getTrackSnapshotStore();
  return enrichTrackSnapshotsFromStore(tracks, snapshots);
}

export function mergeTrackLists(...lists: TrackSnapshot[][]): TrackSnapshot[] {
  const merged = new Map<string, TrackSnapshot>();
  const snapshots = getTrackSnapshotStore();

  for (const list of lists) {
    for (const track of list) {
      if (!isUsefulTrack(track)) continue;
      merged.set(
        track.id,
        enrichTrackSnapshotFromStore(
          mergeTrackSnapshots(merged.get(track.id), track),
          snapshots,
        ),
      );
    }
  }

  return Array.from(merged.values());
}

export function rememberSearchResults(
  query: string,
  tracks: TrackSnapshot[],
  sourceId = 'youtube_music',
) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || tracks.length === 0) return;

  rememberTrackSnapshots(tracks);
  const normalized = normalizeQuery(trimmedQuery);
  const entries = readJson<SearchCacheEntry[]>(SEARCH_CACHE_KEY, [])
    .filter((entry) => normalizeQuery(entry.query) !== normalized || (entry.sourceId ?? 'youtube_music') !== sourceId);

  entries.unshift({
    query: trimmedQuery,
    tracks: enrichTrackSnapshots(tracks.slice(0, MAX_SEARCH_TRACKS)),
    savedAt: Date.now(),
    sourceId,
  });
  writeJson(SEARCH_CACHE_KEY, entries.slice(0, MAX_SEARCH_ENTRIES));
}

export function getCachedSearch(query: string, sourceId = 'youtube_music'): SearchCacheEntry | null {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  const entry = readJson<SearchCacheEntry[]>(SEARCH_CACHE_KEY, [])
    .find((candidate) =>
      normalizeQuery(candidate.query) === normalized
      && (candidate.sourceId ?? 'youtube_music') === sourceId,
    );
  return entry
    ? { ...entry, tracks: enrichTrackSnapshots(entry.tracks) }
    : null;
}

export function getLatestCachedSearch(): SearchCacheEntry | null {
  const [entry] = readJson<SearchCacheEntry[]>(SEARCH_CACHE_KEY, [])
    .sort((a, b) => b.savedAt - a.savedAt);
  return entry
    ? { ...entry, tracks: enrichTrackSnapshots(entry.tracks) }
    : null;
}

export function getRecentCachedSearches(limit = 6): SearchCacheEntry[] {
  const seenQueries = new Set<string>();
  const entries = readJson<SearchCacheEntry[]>(SEARCH_CACHE_KEY, [])
    .sort((a, b) => b.savedAt - a.savedAt)
    .filter((entry) => {
      const normalized = normalizeQuery(entry.query);
      if (!normalized || seenQueries.has(normalized)) return false;
      seenQueries.add(normalized);
      return true;
    })
    .slice(0, limit);

  const snapshots = getTrackSnapshotStore();
  return entries.map((entry) => ({
    ...entry,
    tracks: enrichTrackSnapshotsFromStore(entry.tracks, snapshots),
  }));
}

export function clearSearchCache() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SEARCH_CACHE_KEY);
  } catch (error) {
    console.warn(`Could not clear search cache:`, error);
  }
}

export function deleteRecentSearchEntry(query: string, sourceId = 'youtube_music') {
  const normalized = normalizeQuery(query);
  const entries = readJson<SearchCacheEntry[]>(SEARCH_CACHE_KEY, [])
    .filter((entry) => normalizeQuery(entry.query) !== normalized || (entry.sourceId ?? 'youtube_music') !== sourceId);
  writeJson(SEARCH_CACHE_KEY, entries);
}

export function savePlaybackState(profileId: string, state: PlaybackSaveState) {
  if (!profileId || !isUsefulTrack(state.currentTrack)) return;
  const compactedQueue = compactPlaybackQueueWindow(state.queue, state.queueIndex);
  rememberTrackSnapshots([state.currentTrack, ...compactedQueue.queue]);

  const states = readJson<Record<string, PlaybackSaveState>>(PLAYBACK_STATES_KEY, {});
  states[profileId] = state;
  writeJson(PLAYBACK_STATES_KEY, trimPlaybackProfiles(states));
  savePlaybackProgress(profileId, state.currentTrack, state.progress, state.savedAt);
}

export function savePlaybackProgress(
  profileId: string,
  track: TrackSnapshot,
  progress: number,
  savedAt = Date.now(),
) {
  if (!profileId || !isUsefulTrack(track) || !Number.isFinite(progress)) return;

  const progressByProfile = readJson<Record<string, PlaybackProgressSnapshot>>(PLAYBACK_PROGRESS_KEY, {});
  progressByProfile[profileId] = {
    trackKey: playbackTrackKey(track),
    progress: Math.max(0, progress),
    savedAt,
  };
  writeJson(PLAYBACK_PROGRESS_KEY, trimPlaybackProfiles(progressByProfile));
}

export function getPlaybackState(profileId: string): PlaybackSaveState | null {
  const state = readJson<Record<string, PlaybackSaveState>>(PLAYBACK_STATES_KEY, {})[profileId];
  if (!state || !isUsefulTrack(state.currentTrack)) return null;
  const progress = readJson<Record<string, PlaybackProgressSnapshot>>(PLAYBACK_PROGRESS_KEY, {})[profileId];
  const snapshots = getTrackSnapshotStore();
  const [currentTrack, ...queue] = enrichTrackSnapshotsFromStore(
    [state.currentTrack, ...state.queue],
    snapshots,
  );

  return {
    ...state,
    currentTrack,
    queue,
    progress: progress
      && progress.trackKey === playbackTrackKey(state.currentTrack)
      && progress.savedAt >= state.savedAt
      ? progress.progress
      : state.progress,
    savedAt: progress
      && progress.trackKey === playbackTrackKey(state.currentTrack)
      && progress.savedAt >= state.savedAt
      ? progress.savedAt
      : state.savedAt,
  };
}
