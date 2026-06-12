export interface LastFmProviderRequest {
  sessionKey?: string;
}

export interface LastFmAccountConnection {
  sessionKey: string;
}

interface ResolveLastFmSessionKeyInput {
  provider?: LastFmProviderRequest;
  databaseConfigured: boolean;
  getSessionUserId: () => Promise<string | null>;
  getConnection: (userId: string) => Promise<LastFmAccountConnection | null>;
}

export async function resolveLastFmSessionKey({
  provider,
  databaseConfigured,
  getSessionUserId,
  getConnection,
}: ResolveLastFmSessionKeyInput) {
  const directSessionKey = provider?.sessionKey?.trim();
  if (directSessionKey) return directSessionKey;

  if (!provider || !databaseConfigured) return undefined;

  const userId = await getSessionUserId();
  if (!userId) return undefined;

  return (await getConnection(userId))?.sessionKey;
}
