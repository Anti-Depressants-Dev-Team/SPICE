import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { remotePairingCodes } from '@/db/schema';
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
  { params }: { params: Promise<{ pairingId: string }> },
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

  const { pairingId } = await params;
  if (!uuidPattern.test(pairingId)) {
    return jsonResponse({ error: 'invalid_pairing_id', message: 'Pairing id must be a UUID.' }, { status: 400 }, request);
  }
  const now = new Date();
  const [revoked] = await db
    .update(remotePairingCodes)
    .set({ revokedAt: now })
    .where(and(
      eq(remotePairingCodes.id, pairingId),
      eq(remotePairingCodes.userId, principal.userId),
      isNull(remotePairingCodes.consumedAt),
      isNull(remotePairingCodes.revokedAt),
    ))
    .returning({ id: remotePairingCodes.id });

  if (!revoked) {
    return jsonResponse(
      { error: 'pairing_not_found', message: 'Pairing code is missing, expired, consumed, or already revoked.' },
      { status: 404 },
      request,
    );
  }

  return jsonResponse({ success: true, pairingId: revoked.id, revokedAt: now.toISOString() }, {}, request);
}
