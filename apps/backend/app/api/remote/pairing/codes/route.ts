import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { remoteDevices, remotePairingCodes } from '@/db/schema';
import { jsonResponse, optionsResponse } from '@/lib/cors';
import {
  authorizeSpiceConnectAccountRequest,
  SpiceConnectAuthorizationError,
} from '@/lib/spice-connect-authorization';
import {
  createPairingCode,
  hashPairingCode,
  normalizePairingDeviceInput,
  SPICE_CONNECT_PAIRING_CODE_TTL_MS,
} from '@/lib/spice-connect-pairing';

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store, max-age=0' };

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const issuer = normalizePairingDeviceInput({
    deviceId: body.issuerDeviceId,
    displayName: 'Spice Connect issuer',
  });
  if (!issuer) {
    return jsonResponse(
      { error: 'invalid_device', message: 'A valid issuerDeviceId is required.' },
      { status: 400 },
      request,
    );
  }

  const registeredIssuer = await db.query.remoteDevices.findFirst({
    where: and(
      eq(remoteDevices.userId, principal.userId),
      eq(remoteDevices.deviceId, issuer.deviceId),
    ),
  });
  if (!registeredIssuer) {
    return jsonResponse(
      { error: 'issuer_not_registered', message: 'Register this Spice Connect device before creating a pairing code.' },
      { status: 404 },
      request,
    );
  }

  const now = new Date();
  await db
    .update(remotePairingCodes)
    .set({ revokedAt: now })
    .where(and(
      eq(remotePairingCodes.userId, principal.userId),
      eq(remotePairingCodes.issuerDeviceId, issuer.deviceId),
      isNull(remotePairingCodes.consumedAt),
      isNull(remotePairingCodes.revokedAt),
    ));

  const code = createPairingCode();
  const codeHash = hashPairingCode(code.normalized);
  if (!codeHash) {
    return jsonResponse({ error: 'pairing_failed', message: 'Could not create a pairing code.' }, { status: 500 }, request);
  }

  const expiresAt = new Date(now.getTime() + SPICE_CONNECT_PAIRING_CODE_TTL_MS);
  const [created] = await db
    .insert(remotePairingCodes)
    .values({
      userId: principal.userId,
      issuerDeviceId: issuer.deviceId,
      codeHash,
      createdAt: now,
      expiresAt,
    })
    .returning({ id: remotePairingCodes.id });

  return jsonResponse({
    pairingId: created.id,
    code: code.display,
    expiresAt: expiresAt.toISOString(),
    issuerDevice: {
      deviceId: registeredIssuer.deviceId,
      displayName: registeredIssuer.displayName,
    },
  }, { status: 201, headers: noStore }, request);
}
