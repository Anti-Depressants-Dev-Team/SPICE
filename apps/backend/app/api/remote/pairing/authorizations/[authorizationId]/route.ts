import { and, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { remoteCommands, remoteDeviceAuthorizations } from '@/db/schema';
import { jsonResponse, optionsResponse } from '@/lib/cors';
import {
  authorizeSpiceConnectAccountRequest,
  SpiceConnectAuthorizationError,
} from '@/lib/spice-connect-authorization';

export const runtime = 'nodejs';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ authorizationId: string }> },
) {
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

  const { authorizationId } = await params;
  if (!uuidPattern.test(authorizationId)) {
    return jsonResponse(
      { error: 'invalid_authorization_id', message: 'Authorization id must be a UUID.' },
      { status: 400 },
      request,
    );
  }
  const now = new Date();
  const [revoked] = await db
    .update(remoteDeviceAuthorizations)
    .set({ revokedAt: now })
    .where(and(
      eq(remoteDeviceAuthorizations.id, authorizationId),
      eq(remoteDeviceAuthorizations.userId, principal.userId),
      isNull(remoteDeviceAuthorizations.revokedAt),
    ))
    .returning({
      id: remoteDeviceAuthorizations.id,
      deviceId: remoteDeviceAuthorizations.deviceId,
    });

  if (!revoked) {
    return jsonResponse(
      { error: 'authorization_not_found', message: 'Paired device authorization was not found or is already revoked.' },
      { status: 404 },
      request,
    );
  }

  await db
    .update(remoteCommands)
    .set({ consumedAt: now })
    .where(and(
      eq(remoteCommands.userId, principal.userId),
      isNull(remoteCommands.consumedAt),
      or(
        eq(remoteCommands.sourceDeviceId, revoked.deviceId),
        eq(remoteCommands.targetDeviceId, revoked.deviceId),
      ),
    ));

  return jsonResponse({
    success: true,
    authorizationId: revoked.id,
    deviceId: revoked.deviceId,
    revokedAt: now.toISOString(),
  }, {}, request);
}
