import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';

import { db } from '@/db';
import { remoteDeviceAuthorizations, users } from '@/db/schema';
import { verifySession } from '@/lib/auth';
import {
  hashRemoteDeviceToken,
  isSpiceConnectAccountRoleActive,
  isRemoteDeviceToken,
} from '@/lib/spice-connect-pairing';

export type SpiceConnectPrincipal = {
  kind: 'account';
  userId: string;
  deviceId: null;
} | {
  kind: 'paired_device';
  userId: string;
  deviceId: string;
  authorizationId: string;
};

export class SpiceConnectAuthorizationError extends Error {
  readonly code: 'unauthorized' | 'device_forbidden';
  readonly status: 401 | 403;

  constructor(code: 'unauthorized' | 'device_forbidden', message: string, status: 401 | 403) {
    super(message);
    this.name = 'SpiceConnectAuthorizationError';
    this.code = code;
    this.status = status;
  }
}

function bearerToken(request: Request) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.substring(7).trim();
  return token || null;
}

async function requireActiveSpiceConnectAccount(userId: string) {
  const account = await db.query.users.findFirst({
    columns: { id: true, accountRole: true },
    where: eq(users.id, userId),
  });
  if (!account || !isSpiceConnectAccountRoleActive(account.accountRole)) {
    throw new SpiceConnectAuthorizationError('unauthorized', 'Invalid or expired credential.', 401);
  }
}

export async function authorizeSpiceConnectAccountRequest(request: Request): Promise<Extract<SpiceConnectPrincipal, { kind: 'account' }>> {
  const token = bearerToken(request);
  if (!token || isRemoteDeviceToken(token)) {
    throw new SpiceConnectAuthorizationError('unauthorized', 'An active account credential is required.', 401);
  }
  try {
    const session = await verifySession(token);
    await requireActiveSpiceConnectAccount(session.userId);
    return { kind: 'account', userId: session.userId, deviceId: null };
  } catch (error) {
    if (error instanceof SpiceConnectAuthorizationError) throw error;
    throw new SpiceConnectAuthorizationError('unauthorized', 'Invalid or expired credential.', 401);
  }
}

export async function authorizeSpiceConnectRequest(request: Request): Promise<SpiceConnectPrincipal> {
  const token = bearerToken(request);
  if (!token) {
    throw new SpiceConnectAuthorizationError('unauthorized', 'Missing auth header.', 401);
  }

  if (!isRemoteDeviceToken(token)) {
    return authorizeSpiceConnectAccountRequest(request);
  }

  const tokenHash = hashRemoteDeviceToken(token);
  if (!tokenHash) {
    throw new SpiceConnectAuthorizationError('unauthorized', 'Invalid or expired credential.', 401);
  }

  const now = new Date();
  const [authorization] = await db
    .select({
      id: remoteDeviceAuthorizations.id,
      userId: remoteDeviceAuthorizations.userId,
      deviceId: remoteDeviceAuthorizations.deviceId,
      lastUsedAt: remoteDeviceAuthorizations.lastUsedAt,
      accountRole: users.accountRole,
    })
    .from(remoteDeviceAuthorizations)
    .innerJoin(users, eq(users.id, remoteDeviceAuthorizations.userId))
    .where(and(
      eq(remoteDeviceAuthorizations.tokenHash, tokenHash),
      isNull(remoteDeviceAuthorizations.revokedAt),
      gt(remoteDeviceAuthorizations.expiresAt, now),
    ))
    .limit(1);

  if (!authorization || !isSpiceConnectAccountRoleActive(authorization.accountRole)) {
    throw new SpiceConnectAuthorizationError('unauthorized', 'Invalid or expired credential.', 401);
  }

  const lastUsedCutoff = new Date(now.getTime() - 15 * 60 * 1000);
  if (!authorization.lastUsedAt || authorization.lastUsedAt < lastUsedCutoff) {
    await db
      .update(remoteDeviceAuthorizations)
      .set({ lastUsedAt: now })
      .where(and(
        eq(remoteDeviceAuthorizations.id, authorization.id),
        isNull(remoteDeviceAuthorizations.revokedAt),
        or(
          isNull(remoteDeviceAuthorizations.lastUsedAt),
          lt(remoteDeviceAuthorizations.lastUsedAt, lastUsedCutoff),
        ),
      ));
  }

  return {
    kind: 'paired_device',
    userId: authorization.userId,
    deviceId: authorization.deviceId,
    authorizationId: authorization.id,
  };
}

export function requirePrincipalDevice(principal: SpiceConnectPrincipal, deviceId: string) {
  if (principal.kind === 'paired_device' && principal.deviceId !== deviceId) {
    throw new SpiceConnectAuthorizationError(
      'device_forbidden',
      'This paired credential is restricted to its authorized device.',
      403,
    );
  }
}
