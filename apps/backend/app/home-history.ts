export interface HomeHistoryTrack {
  id: string;
  sourceId?: string;
  msListened?: number;
}

export const HOME_RECENTLY_PLAYED_LIMIT = 8;
export const FORGOTTEN_FAVORITES_LIMIT = 8;

// Meaningful listening is credited in 30-second units. Requiring 90 seconds
// means a track needs at least three separate meaningful listens to qualify.
export const FORGOTTEN_FAVORITE_MIN_LISTEN_MS = 90_000;

const homeHistoryTrackKey = (track: HomeHistoryTrack) =>
  `${track.sourceId ?? 'youtube_music'}:${track.id}`;

const validHistoryTrack = <TTrack extends HomeHistoryTrack>(track: TTrack) =>
  Boolean(
    track.id
    && track.id !== 'placeholder'
    && track.id !== 'spice-connect-placeholder',
  );

export interface HomeHistoryShelves<TTrack extends HomeHistoryTrack> {
  recentlyPlayed: TTrack[];
  forgottenFavorites: TTrack[];
}

/**
 * Splits profile history into two non-overlapping home shelves.
 *
 * History is stored most-recent-first. Forgotten favorites therefore come
 * only from entries beyond the recent window, must have repeated meaningful
 * listening credit, and are ordered from least recently played to most recent.
 */
export function buildHomeHistoryShelves<TTrack extends HomeHistoryTrack>(
  history: readonly TTrack[],
): HomeHistoryShelves<TTrack> {
  const seen = new Set<string>();
  const uniqueHistory: TTrack[] = [];

  for (const track of history) {
    if (!validHistoryTrack(track)) continue;
    const key = homeHistoryTrackKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueHistory.push(track);
  }

  const recentlyPlayed = uniqueHistory.slice(0, HOME_RECENTLY_PLAYED_LIMIT);
  const recentKeys = new Set(recentlyPlayed.map(homeHistoryTrackKey));

  const forgottenFavorites = uniqueHistory
    .map((track, historyIndex) => ({
      track,
      historyIndex,
      listenMs: Number.isFinite(track.msListened) ? Math.max(0, track.msListened ?? 0) : 0,
    }))
    .filter(({ track, historyIndex, listenMs }) => (
      historyIndex >= HOME_RECENTLY_PLAYED_LIMIT
      && listenMs >= FORGOTTEN_FAVORITE_MIN_LISTEN_MS
      && !recentKeys.has(homeHistoryTrackKey(track))
    ))
    .sort((left, right) => (
      right.historyIndex - left.historyIndex
      || right.listenMs - left.listenMs
      || homeHistoryTrackKey(left.track).localeCompare(homeHistoryTrackKey(right.track))
    ))
    .slice(0, FORGOTTEN_FAVORITES_LIMIT)
    .map(({ track }) => track);

  return { recentlyPlayed, forgottenFavorites };
}
