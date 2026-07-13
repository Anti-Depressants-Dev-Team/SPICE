import { desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { remoteDeviceAuthorizations } from '@/db/schema';
import { jsonResponse, optionsResponse } from '@/lib/cors';
import { isRemoteDeviceAuthorizationActive } from '@/lib/spice-connect-pairing';
import {
  authorizeSpiceConnectAccountRequest,
  SpiceConnectAuthorizationError,
} from '@/lib/spice-connect-authorization';

export const runtime = 'nodejs';

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function GET(request: Request) {
  let principal;
  try {
    principal = await authorizeSpiceConnectAccountRequest(request);
  } catch (error) {
    const status = error instanceof SpiceConnectAuthorizationError ? error.status : 401;
    return jsonResponse({ error: 'unauthorized', message: 'Invalid or expired credential.' }, { status }, request);
  }

  if (!process.env.DATABASE_URL) {
    return jsonResponse(
      { error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' },
      { status: 500 },
      request,
    );
  }

  const authorizations = await db.query.remoteDeviceAuthorizations.findMany({
    where: eq(remoteDeviceAuthorizations.userId, principal.userId),
    orderBy: desc(remoteDeviceAuthorizations.createdAt),
  });
  const now = new Date();

  return jsonResponse({
    authorizations: authorizations.map((authorization) => ({
      id: authorization.id,
      issuerDeviceId: authorization.issuerDeviceId,
      deviceId: authorization.deviceId,
      displayName: authorization.displayName,
      scope: 'spice_connect',
      status: authorization.revokedAt
        ? 'revoked'
        : isRemoteDeviceAuthorizationActive(authorization, now) ? 'active' : 'expired',
      createdAt: authorization.createdAt.toISOString(),
      expiresAt: authorization.expiresAt.toISOString(),
      lastUsedAt: authorization.lastUsedAt?.toISOString() ?? null,
      revokedAt: authorization.revokedAt?.toISOString() ?? null,
    })),
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } }, request);
}
