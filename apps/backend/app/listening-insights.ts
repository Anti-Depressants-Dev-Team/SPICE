export const LISTENING_INSIGHTS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const LISTENING_EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const LISTENING_SESSION_GAP_MS = 30 * 60 * 1000;
export const MAX_LISTENING_EVENTS = 1_000;

export interface ListeningEvent {
  id: string;
  trackId: string;
  sourceId: string;
  title: string;
  artistNames: string[];
  listenedMs: number;
  completedAt: number;
  discovered: boolean;
}

export interface WeeklyListeningRecap {
  eventCount: number;
  uniqueTrackCount: number;
  creditedMinutes: number;
  discoveryPercent: number;
  longestSessionMinutes: number;
  topArtists: { name: string; listens: number }[];
  topSource: string | null;
}

const normalizedString = (value: unknown, fallback = '') => (
  typeof value === 'string' ? value.trim() : fallback
);

const normalizedEvent = (value: unknown): ListeningEvent | null => {
  if (!value || typeof value !== 'object') return null;
  const event = value as Partial<ListeningEvent>;
  const trackId = normalizedString(event.trackId);
  const completedAt = Number(event.completedAt);
  if (!trackId || !Number.isFinite(completedAt)) return null;
  const listenedMs = Number(event.listenedMs);
  return {
    id: normalizedString(event.id, `${event.sourceId || 'youtube_music'}:${trackId}:${completedAt}`),
    trackId,
    sourceId: normalizedString(event.sourceId, 'youtube_music'),
    title: normalizedString(event.title, 'Track'),
    artistNames: Array.isArray(event.artistNames)
      ? event.artistNames.map((artist) => normalizedString(artist)).filter(Boolean).slice(0, 8)
      : [],
    listenedMs: Number.isFinite(listenedMs) ? Math.max(0, Math.min(24 * 60 * 60 * 1000, Math.round(listenedMs))) : 0,
    completedAt,
    discovered: event.discovered === true,
  };
};

export function normalizeListeningEvents(values: unknown, now = Date.now()) {
  if (!Array.isArray(values)) return [];
  const cutoff = now - LISTENING_EVENT_RETENTION_MS;
  return values
    .map(normalizedEvent)
    .filter((event): event is ListeningEvent => Boolean(event && event.completedAt >= cutoff && event.completedAt <= now + 60_000))
    .sort((left, right) => right.completedAt - left.completedAt)
    .slice(0, MAX_LISTENING_EVENTS);
}

export function appendListeningEvent(
  events: readonly ListeningEvent[],
  input: Omit<ListeningEvent, 'id'> & { id?: string },
  now = Date.now(),
) {
  const event = normalizedEvent({
    ...input,
    id: input.id || `${input.sourceId}:${input.trackId}:${input.completedAt}`,
  });
  if (!event) return normalizeListeningEvents(events, now);
  return normalizeListeningEvents([event, ...events.filter((item) => item.id !== event.id)], now);
}

export function buildWeeklyListeningRecap(
  values: readonly ListeningEvent[],
  now = Date.now(),
): WeeklyListeningRecap {
  const events = normalizeListeningEvents(values, now)
    .filter((event) => event.completedAt >= now - LISTENING_INSIGHTS_WINDOW_MS)
    .sort((left, right) => left.completedAt - right.completedAt);
  if (events.length === 0) {
    return {
      eventCount: 0,
      uniqueTrackCount: 0,
      creditedMinutes: 0,
      discoveryPercent: 0,
      longestSessionMinutes: 0,
      topArtists: [],
      topSource: null,
    };
  }

  const tracks = new Set<string>();
  const artistCounts = new Map<string, { name: string; listens: number }>();
  const sourceCounts = new Map<string, number>();
  let creditedMs = 0;
  let discoveries = 0;
  let currentSessionMs = 0;
  let longestSessionMs = 0;
  let previousCompletedAt: number | null = null;

  for (const event of events) {
    tracks.add(`${event.sourceId}:${event.trackId}`.toLocaleLowerCase());
    creditedMs += event.listenedMs;
    discoveries += event.discovered ? 1 : 0;
    sourceCounts.set(event.sourceId, (sourceCounts.get(event.sourceId) ?? 0) + 1);
    for (const artistName of event.artistNames) {
      const key = artistName.toLocaleLowerCase();
      const current = artistCounts.get(key);
      artistCounts.set(key, {
        name: current?.name || artistName,
        listens: (current?.listens ?? 0) + 1,
      });
    }

    if (previousCompletedAt === null || event.completedAt - previousCompletedAt <= LISTENING_SESSION_GAP_MS) {
      currentSessionMs += event.listenedMs;
    } else {
      longestSessionMs = Math.max(longestSessionMs, currentSessionMs);
      currentSessionMs = event.listenedMs;
    }
    previousCompletedAt = event.completedAt;
  }
  longestSessionMs = Math.max(longestSessionMs, currentSessionMs);

  const topSource = Array.from(sourceCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;

  return {
    eventCount: events.length,
    uniqueTrackCount: tracks.size,
    creditedMinutes: Math.round((creditedMs / 60_000) * 10) / 10,
    discoveryPercent: Math.round((discoveries / events.length) * 100),
    longestSessionMinutes: Math.round((longestSessionMs / 60_000) * 10) / 10,
    topArtists: Array.from(artistCounts.values())
      .sort((left, right) => right.listens - left.listens || left.name.localeCompare(right.name))
      .slice(0, 5),
    topSource,
  };
}
