const PROFILE_CLOUD_METADATA_KEYS = new Set([
  'displayName',
  'bio',
  'gradient',
  'joinedAt',
  'passcode',
  'avatarUrl',
  'isPrivate',
]);

export function requiresProfileMetadataSync(keys: Iterable<string>) {
  for (const key of keys) {
    if (PROFILE_CLOUD_METADATA_KEYS.has(key)) return true;
  }
  return false;
}
