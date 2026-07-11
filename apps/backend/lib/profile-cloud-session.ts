interface CloudSessionProfile {
  id?: unknown;
  cloudToken?: unknown;
  cloudUser?: unknown;
  cloudUsername?: unknown;
}

interface StorageReader {
  getItem(key: string): string | null;
}

export interface StoredCloudSession<TUser> {
  token: string | null;
  user: TUser | null;
  username: string | null;
}

export function isHydratedCloudToken(
  isProfileHydrated: boolean,
  token: string | null,
): token is string {
  return isProfileHydrated && readString(token) !== null;
}

export function readCloudSessionFromStorage<TUser>(
  storage: StorageReader,
  activeProfileId = 'default',
): StoredCloudSession<TUser> {
  const profiles = parseProfiles(storage.getItem('spice_profiles_list'));
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const profileToken = readString(activeProfile?.cloudToken);
  if (profileToken) {
    return {
      token: profileToken,
      user: readObject<TUser>(activeProfile?.cloudUser),
      username: readString(activeProfile?.cloudUsername),
    };
  }

  const fallbackUser = parseObject<TUser>(storage.getItem('spice_cloud_user'));

  return {
    token: readString(storage.getItem('spice_cloud_token')),
    user: fallbackUser,
    username: null,
  };
}

function parseProfiles(value: string | null): CloudSessionProfile[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isObject) : [];
  } catch {
    return [];
  }
}

function parseObject<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return readObject<T>(JSON.parse(value));
  } catch {
    return null;
  }
}

function readObject<T>(value: unknown): T | null {
  return isObject(value) ? value as T : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
