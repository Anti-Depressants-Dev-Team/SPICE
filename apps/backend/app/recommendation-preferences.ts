export const RECOMMENDATION_ARTIST_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SnoozedRecommendationArtist {
  key: string;
  label: string;
  until: number;
}

export interface RecommendationPreferences {
  discoveryLevel: number;
  hiddenTrackKeys: string[];
  snoozedArtists: SnoozedRecommendationArtist[];
}

export const DEFAULT_RECOMMENDATION_PREFERENCES: RecommendationPreferences = {
  discoveryLevel: 60,
  hiddenTrackKeys: [],
  snoozedArtists: [],
};

export interface PreferenceTrack {
  id: string;
  sourceId?: string;
  artists?: readonly { id?: string; name?: string }[];
}

export const recommendationArtistKey = (artist: { id?: string; name?: string }) => (
  (artist.id || artist.name || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
);

export const recommendationTrackKey = (track: PreferenceTrack) => (
  `${track.sourceId || 'youtube_music'}:${track.id}`.trim().toLocaleLowerCase()
);

export function normalizeRecommendationPreferences(
  value: unknown,
  now = Date.now(),
): RecommendationPreferences {
  if (!value || typeof value !== 'object') return { ...DEFAULT_RECOMMENDATION_PREFERENCES };
  const input = value as Partial<RecommendationPreferences>;
  const discoveryLevel = Number(input.discoveryLevel);
  const hiddenTrackKeys = Array.isArray(input.hiddenTrackKeys)
    ? [...new Set(input.hiddenTrackKeys.filter((key): key is string => typeof key === 'string' && Boolean(key.trim())).map((key) => key.trim().toLocaleLowerCase()))].slice(0, 500)
    : [];
  const snoozedArtists = Array.isArray(input.snoozedArtists)
    ? input.snoozedArtists.flatMap((artist) => {
      if (!artist || typeof artist !== 'object') return [];
      const key = typeof artist.key === 'string' ? artist.key.trim().toLocaleLowerCase() : '';
      const label = typeof artist.label === 'string' ? artist.label.trim() : '';
      const until = Number(artist.until);
      return key && label && Number.isFinite(until) && until > now
        ? [{ key, label, until }]
        : [];
    }).slice(0, 100)
    : [];
  return {
    discoveryLevel: Number.isFinite(discoveryLevel)
      ? Math.max(0, Math.min(100, Math.round(discoveryLevel)))
      : DEFAULT_RECOMMENDATION_PREFERENCES.discoveryLevel,
    hiddenTrackKeys,
    snoozedArtists,
  };
}

export function hideRecommendedTrack(
  preferences: RecommendationPreferences,
  track: PreferenceTrack,
  now = Date.now(),
) {
  const normalized = normalizeRecommendationPreferences(preferences, now);
  return normalizeRecommendationPreferences({
    ...normalized,
    hiddenTrackKeys: [recommendationTrackKey(track), ...normalized.hiddenTrackKeys],
  }, now);
}

export function snoozeRecommendedArtist(
  preferences: RecommendationPreferences,
  artist: { id?: string; name?: string },
  now = Date.now(),
) {
  const normalized = normalizeRecommendationPreferences(preferences, now);
  const key = recommendationArtistKey(artist);
  const label = artist.name?.trim() || artist.id?.trim() || 'Artist';
  if (!key) return normalized;
  return normalizeRecommendationPreferences({
    ...normalized,
    snoozedArtists: [
      { key, label, until: now + RECOMMENDATION_ARTIST_SNOOZE_MS },
      ...normalized.snoozedArtists.filter((entry) => entry.key !== key),
    ],
  }, now);
}

export function isRecommendationHidden(
  track: PreferenceTrack,
  preferences: RecommendationPreferences,
  now = Date.now(),
) {
  const normalized = normalizeRecommendationPreferences(preferences, now);
  if (normalized.hiddenTrackKeys.includes(recommendationTrackKey(track))) return true;
  const snoozedKeys = new Set(normalized.snoozedArtists.map((artist) => artist.key));
  return (track.artists || []).some((artist) => snoozedKeys.has(recommendationArtistKey(artist)));
}

export function recommendationPreferenceScoreAdjustment({
  knownTrack,
  discoveryLevel,
}: {
  knownTrack: boolean;
  discoveryLevel: number;
}) {
  const normalizedLevel = Math.max(0, Math.min(100, discoveryLevel));
  return knownTrack
    ? (50 - normalizedLevel) * 0.12
    : normalizedLevel * 0.02;
}
