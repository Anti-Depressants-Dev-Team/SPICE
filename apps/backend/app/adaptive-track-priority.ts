export type AdaptiveListenOutcome = 'completed' | 'skipped';

export interface AdaptiveTrackPriorityEntry {
  score: number;
  completed: number;
  skipped: number;
  updatedAt: number;
}

export interface AdaptiveTrackPriorityState {
  version: 1;
  tracks: Record<string, AdaptiveTrackPriorityEntry>;
}

export interface AdaptiveListenObservation {
  completedNaturally: boolean;
}

export interface AdaptiveSeekObservation {
  positionMs: number;
  seekPositionMs: number;
  durationMs: number;
}

const STATE_VERSION = 1 as const;
const MIN_SCORE = -8;
const MAX_SCORE = 8;
const MIN_WEIGHT = 0.25;
const MAX_WEIGHT = 4;
const MAX_TRACKS = 2_000;
const MAX_COUNTER = 1_000_000;
const COMPLETION_SEEK_WINDOW_MS = 3_000;
const MIN_FORWARD_SEEK_MS = 1_000;

export const EMPTY_ADAPTIVE_TRACK_PRIORITY_STATE: AdaptiveTrackPriorityState = Object.freeze({
  version: STATE_VERSION,
  tracks: Object.freeze({}),
});

const finiteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const boundedInteger = (value: unknown, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(maximum, Math.trunc(finiteNumber(value, minimum))))
);

const safeTrackKey = (value: unknown) => {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!key || key.length > 512 || key === '__proto__' || key === 'constructor' || key === 'prototype') {
    return '';
  }
  return key;
};

export function normalizeAdaptiveTrackPriorityState(value: unknown): AdaptiveTrackPriorityState {
  if (!value || typeof value !== 'object') return EMPTY_ADAPTIVE_TRACK_PRIORITY_STATE;
  const rawTracks = (value as Partial<AdaptiveTrackPriorityState>).tracks;
  if (!rawTracks || typeof rawTracks !== 'object' || Array.isArray(rawTracks)) {
    return EMPTY_ADAPTIVE_TRACK_PRIORITY_STATE;
  }

  const entries = Object.entries(rawTracks)
    .map(([rawKey, rawEntry]) => {
      const key = safeTrackKey(rawKey);
      if (!key || !rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return null;
      const entry = rawEntry as Partial<AdaptiveTrackPriorityEntry>;
      return [key, {
        score: boundedInteger(entry.score, MIN_SCORE, MAX_SCORE),
        completed: boundedInteger(entry.completed, 0, MAX_COUNTER),
        skipped: boundedInteger(entry.skipped, 0, MAX_COUNTER),
        updatedAt: Math.max(0, Math.trunc(finiteNumber(entry.updatedAt))),
      }] as const;
    })
    .filter((entry): entry is readonly [string, AdaptiveTrackPriorityEntry] => entry !== null)
    .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
    .slice(0, MAX_TRACKS);

  return {
    version: STATE_VERSION,
    tracks: Object.fromEntries(entries),
  };
}

export function classifyAdaptiveListen(observation: AdaptiveListenObservation): AdaptiveListenOutcome {
  return observation.completedNaturally ? 'completed' : 'skipped';
}

export function shouldTreatAdaptiveSeekAsSkip(observation: AdaptiveSeekObservation) {
  const positionMs = finiteNumber(observation.positionMs);
  const seekPositionMs = finiteNumber(observation.seekPositionMs);
  const durationMs = finiteNumber(observation.durationMs);
  return durationMs > 0
    && seekPositionMs - positionMs >= MIN_FORWARD_SEEK_MS
    && durationMs - seekPositionMs <= COMPLETION_SEEK_WINDOW_MS;
}

export function recordAdaptiveListenOutcome(
  value: unknown,
  rawTrackKey: string,
  outcome: AdaptiveListenOutcome,
  now = Date.now(),
): AdaptiveTrackPriorityState {
  const state = normalizeAdaptiveTrackPriorityState(value);
  const trackKey = safeTrackKey(rawTrackKey);
  if (!trackKey || (outcome !== 'completed' && outcome !== 'skipped')) return state;

  const previous = state.tracks[trackKey] || {
    score: 0,
    completed: 0,
    skipped: 0,
    updatedAt: 0,
  };
  const completed = outcome === 'completed';
  const nextEntry: AdaptiveTrackPriorityEntry = {
    score: Math.max(MIN_SCORE, Math.min(MAX_SCORE, previous.score + (completed ? 1 : -1))),
    completed: Math.min(MAX_COUNTER, previous.completed + (completed ? 1 : 0)),
    skipped: Math.min(MAX_COUNTER, previous.skipped + (completed ? 0 : 1)),
    updatedAt: Math.max(0, Math.trunc(finiteNumber(now, Date.now()))),
  };

  return normalizeAdaptiveTrackPriorityState({
    version: STATE_VERSION,
    tracks: {
      ...state.tracks,
      [trackKey]: nextEntry,
    },
  });
}

export function adaptiveTrackWeight(value: unknown, rawTrackKey: string) {
  const state = normalizeAdaptiveTrackPriorityState(value);
  const trackKey = safeTrackKey(rawTrackKey);
  const score = trackKey ? state.tracks[trackKey]?.score ?? 0 : 0;
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, 2 ** (score / 3)));
}

export function adaptiveTrackWeights(value: unknown, trackKeys: string[]) {
  const state = normalizeAdaptiveTrackPriorityState(value);
  return trackKeys.map((trackKey) => {
    const key = safeTrackKey(trackKey);
    const score = key ? state.tracks[key]?.score ?? 0 : 0;
    return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, 2 ** (score / 3)));
  });
}
