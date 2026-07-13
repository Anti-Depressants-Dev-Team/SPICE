import {
  MAX_CROSSFADE_DURATION_MS,
  type CrossfadeCurve,
} from './crossfade.ts';
import {
  DEFAULT_ARTIST_DIVERSITY_PENALTY,
  DEFAULT_LIKED_BOOST,
  DEFAULT_RECENT_ARTIST_PENALTY,
  DEFAULT_SOURCE_DIVERSITY_PENALTY,
} from './smart-queue.ts';

export const PLAYBACK_PROFILE_SCHEMA_VERSION = 1;
export const PLAYBACK_PROFILE_STORAGE_KEY = 'spice_playback_profiles_v1';
export const MAX_PLAYBACK_PROFILES = 12;

export interface PlaybackProfile {
  id: string;
  name: string;
  crossfade: {
    enabled: boolean;
    durationMs: number;
    curve: CrossfadeCurve;
  };
  smartQueue: {
    enabled: boolean;
    recentTrackWindow: number;
    recentArtistWindow: number;
    likedBoost: number;
    recentArtistPenalty: number;
    sourceDiversityPenalty: number;
    artistDiversityPenalty: number;
  };
}

export interface PlaybackProfileState {
  version: typeof PLAYBACK_PROFILE_SCHEMA_VERSION;
  activeProfileId: string;
  profiles: PlaybackProfile[];
}

export interface PlaybackProfileValidation {
  valid: boolean;
  errors: string[];
}

export interface PlaybackProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlaybackProfilePersistenceResult {
  state: PlaybackProfileState;
  saved: boolean;
}

export const DEFAULT_PLAYBACK_PROFILE: PlaybackProfile = {
  id: 'balanced',
  name: 'Balanced',
  crossfade: {
    enabled: false,
    durationMs: 5_000,
    curve: 'equal-power',
  },
  smartQueue: {
    enabled: true,
    recentTrackWindow: 20,
    recentArtistWindow: 6,
    likedBoost: DEFAULT_LIKED_BOOST,
    recentArtistPenalty: DEFAULT_RECENT_ARTIST_PENALTY,
    sourceDiversityPenalty: DEFAULT_SOURCE_DIVERSITY_PENALTY,
    artistDiversityPenalty: DEFAULT_ARTIST_DIVERSITY_PENALTY,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const boundedInteger = (value: unknown, fallback: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Math.round(finiteNumber(value, fallback))));

const boundedNumber = (value: unknown, fallback: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)));

const bool = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const profileId = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[^a-z0-9]+|[-]+$/g, '')
    .slice(0, 48);
  return normalized || fallback;
};

const profileName = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, 48) || fallback;
};

const cloneDefaultProfile = (): PlaybackProfile => ({
  ...DEFAULT_PLAYBACK_PROFILE,
  crossfade: { ...DEFAULT_PLAYBACK_PROFILE.crossfade },
  smartQueue: { ...DEFAULT_PLAYBACK_PROFILE.smartQueue },
});

export function normalizePlaybackProfile(
  value: unknown,
  fallback: PlaybackProfile = DEFAULT_PLAYBACK_PROFILE,
): PlaybackProfile {
  const record = isRecord(value) ? value : {};
  const crossfade = isRecord(record.crossfade) ? record.crossfade : {};
  const smartQueue = isRecord(record.smartQueue) ? record.smartQueue : {};
  const curve = crossfade.curve === 'linear' || crossfade.curve === 'equal-power'
    ? crossfade.curve
    : fallback.crossfade.curve;

  return {
    id: profileId(record.id, fallback.id),
    name: profileName(record.name, fallback.name),
    crossfade: {
      enabled: bool(crossfade.enabled, fallback.crossfade.enabled),
      durationMs: boundedInteger(
        crossfade.durationMs,
        fallback.crossfade.durationMs,
        0,
        MAX_CROSSFADE_DURATION_MS,
      ),
      curve,
    },
    smartQueue: {
      enabled: bool(smartQueue.enabled, fallback.smartQueue.enabled),
      recentTrackWindow: boundedInteger(
        smartQueue.recentTrackWindow,
        fallback.smartQueue.recentTrackWindow,
        0,
        100,
      ),
      recentArtistWindow: boundedInteger(
        smartQueue.recentArtistWindow,
        fallback.smartQueue.recentArtistWindow,
        0,
        50,
      ),
      likedBoost: boundedNumber(smartQueue.likedBoost, fallback.smartQueue.likedBoost, 0, 100),
      recentArtistPenalty: boundedNumber(
        smartQueue.recentArtistPenalty,
        fallback.smartQueue.recentArtistPenalty,
        0,
        100,
      ),
      sourceDiversityPenalty: boundedNumber(
        smartQueue.sourceDiversityPenalty,
        fallback.smartQueue.sourceDiversityPenalty,
        0,
        100,
      ),
      artistDiversityPenalty: boundedNumber(
        smartQueue.artistDiversityPenalty,
        fallback.smartQueue.artistDiversityPenalty,
        0,
        100,
      ),
    },
  };
}

export function validatePlaybackProfile(value: unknown): PlaybackProfileValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['profile must be an object'] };

  if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,47}$/i.test(value.id)) {
    errors.push('id must contain only letters, numbers, underscores, or hyphens');
  }
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 48) {
    errors.push('name must be between 1 and 48 characters');
  }

  if (!isRecord(value.crossfade)) {
    errors.push('crossfade must be an object');
  } else {
    if (typeof value.crossfade.enabled !== 'boolean') errors.push('crossfade.enabled must be boolean');
    if (
      typeof value.crossfade.durationMs !== 'number'
      || !Number.isFinite(value.crossfade.durationMs)
      || value.crossfade.durationMs < 0
      || value.crossfade.durationMs > MAX_CROSSFADE_DURATION_MS
    ) errors.push(`crossfade.durationMs must be between 0 and ${MAX_CROSSFADE_DURATION_MS}`);
    if (value.crossfade.curve !== 'linear' && value.crossfade.curve !== 'equal-power') {
      errors.push('crossfade.curve must be linear or equal-power');
    }
  }

  if (!isRecord(value.smartQueue)) {
    errors.push('smartQueue must be an object');
  } else {
    if (typeof value.smartQueue.enabled !== 'boolean') errors.push('smartQueue.enabled must be boolean');
    const boundedFields: Array<[string, unknown, number]> = [
      ['recentTrackWindow', value.smartQueue.recentTrackWindow, 100],
      ['recentArtistWindow', value.smartQueue.recentArtistWindow, 50],
      ['likedBoost', value.smartQueue.likedBoost, 100],
      ['recentArtistPenalty', value.smartQueue.recentArtistPenalty, 100],
      ['sourceDiversityPenalty', value.smartQueue.sourceDiversityPenalty, 100],
      ['artistDiversityPenalty', value.smartQueue.artistDiversityPenalty, 100],
    ];
    boundedFields.forEach(([name, field, maximum]) => {
      if (typeof field !== 'number' || !Number.isFinite(field) || field < 0 || field > maximum) {
        errors.push(`smartQueue.${name} must be between 0 and ${maximum}`);
      }
    });
    if (
      typeof value.smartQueue.recentTrackWindow === 'number'
      && !Number.isInteger(value.smartQueue.recentTrackWindow)
    ) errors.push('smartQueue.recentTrackWindow must be an integer');
    if (
      typeof value.smartQueue.recentArtistWindow === 'number'
      && !Number.isInteger(value.smartQueue.recentArtistWindow)
    ) errors.push('smartQueue.recentArtistWindow must be an integer');
  }

  return { valid: errors.length === 0, errors };
}

export function normalizePlaybackProfileState(value: unknown): PlaybackProfileState {
  const record = isRecord(value) ? value : {};
  const sourceProfiles = Array.isArray(record.profiles) ? record.profiles : [];
  const profiles: PlaybackProfile[] = [];
  const seenIds = new Set<string>();

  sourceProfiles.forEach((candidate, index) => {
    if (profiles.length >= MAX_PLAYBACK_PROFILES) return;
    if (!isRecord(candidate)) return;
    const fallback = index === 0 ? DEFAULT_PLAYBACK_PROFILE : {
      ...cloneDefaultProfile(),
      id: `profile-${index + 1}`,
      name: `Playback Profile ${index + 1}`,
    };
    const normalized = normalizePlaybackProfile(candidate, fallback);
    if (seenIds.has(normalized.id)) return;
    seenIds.add(normalized.id);
    profiles.push(normalized);
  });

  if (profiles.length === 0) profiles.push(cloneDefaultProfile());
  const requestedActiveId = typeof record.activeProfileId === 'string'
    ? profileId(record.activeProfileId, profiles[0].id)
    : profiles[0].id;
  const activeProfileId = profiles.some((profile) => profile.id === requestedActiveId)
    ? requestedActiveId
    : profiles[0].id;

  return {
    version: PLAYBACK_PROFILE_SCHEMA_VERSION,
    activeProfileId,
    profiles,
  };
}

export function loadPlaybackProfileState(
  storage: PlaybackProfileStorage,
  key = PLAYBACK_PROFILE_STORAGE_KEY,
): PlaybackProfileState {
  try {
    const raw = storage.getItem(key);
    return normalizePlaybackProfileState(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizePlaybackProfileState(null);
  }
}

export function savePlaybackProfileState(
  storage: PlaybackProfileStorage,
  value: unknown,
  key = PLAYBACK_PROFILE_STORAGE_KEY,
): PlaybackProfilePersistenceResult {
  const state = normalizePlaybackProfileState(value);
  try {
    storage.setItem(key, JSON.stringify(state));
    return { state, saved: true };
  } catch {
    return { state, saved: false };
  }
}
