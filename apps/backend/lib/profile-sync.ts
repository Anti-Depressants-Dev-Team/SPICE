export function mergeSongsPlayedCount(
  localCount: unknown,
  remoteCount: unknown,
  syncedHistoryCount: unknown = 0,
) {
  return Math.max(
    normalizeCount(localCount),
    normalizeCount(remoteCount),
    normalizeCount(syncedHistoryCount),
  );
}

export interface ProfileSyncInput {
  id: string;
  displayName: string;
  cloudUsername?: string | null;
  bio?: string;
  gradient: string;
  songsPlayed?: number;
  joinedAt: string;
  passcode?: string | null;
  avatarUrl?: string | null;
  isPrivate?: boolean;
}

interface StoredProfile {
  displayName: string;
  username: string | null;
  bio: string;
  gradient: string;
  songsPlayed: number;
  joinedAt: string;
  passcode: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
}

export function profileWriteValues(profile: ProfileSyncInput) {
  return {
    displayName: profile.displayName,
    username: profile.cloudUsername || null,
    bio: profile.bio || '',
    gradient: profile.gradient,
    songsPlayed: profile.songsPlayed ?? 0,
    joinedAt: profile.joinedAt,
    passcode: profile.passcode || null,
    avatarUrl: profile.avatarUrl || null,
    isPrivate: profile.isPrivate === true,
  };
}

export function profileWriteMatches(stored: StoredProfile, profile: ProfileSyncInput) {
  const expected = profileWriteValues(profile);
  return stored.displayName === expected.displayName
    && stored.username === expected.username
    && stored.bio === expected.bio
    && stored.gradient === expected.gradient
    && stored.songsPlayed === expected.songsPlayed
    && stored.joinedAt === expected.joinedAt
    && stored.passcode === expected.passcode
    && stored.avatarUrl === expected.avatarUrl
    && stored.isPrivate === expected.isPrivate;
}

function normalizeCount(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}
