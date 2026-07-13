import { and, eq, gt, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import {
  remoteDeviceAuthorizations,
  remoteDevices,
  remotePairingCodes,
} from '@/db/schema';
import { jsonResponse, optionsResponse } from '@/lib/cors';
import {
  createRemoteDeviceToken,
  hashPairingCode,
  hashRemoteDeviceToken,
  normalizePairingCode,
  normalizePairingDeviceInput,
  SPICE_CONNECT_DEVICE_AUTH_TTL_MS,
} from '@/lib/spice-connect-pairing';
import { reserveDurableRateLimits } from '@/lib/durable-rate-limit';
import {
  hashRateLimitRequestIp,
  hashScopedRateLimitKey,
  normalizeRateLimitValue,
  PAIRING_CLAIM_RATE_LIMIT_WINDOW_MS,
  PAIRING_CODE_ATTEMPTS_PER_WINDOW,
  PAIRING_IP_ATTEMPTS_PER_WINDOW,
} from '@/lib/rate-limit-policy';

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store, max-age=0' };

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return jsonResponse(
      { error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' },
      { status: 500 },
      request,
    );
  }

  const body = await request.json().catch(() => ({}));
  const normalizedCode = normalizePairingCode(body.code);
  const codeRateValue = normalizedCode ?? normalizeRateLimitValue(body.code, 32);
  const claimQuota = await reserveDurableRateLimits({
    windowMs: PAIRING_CLAIM_RATE_LIMIT_WINDOW_MS,
    reservations: [
      {
        scope: 'remote_pair_claim_code',
        keyHash: hashScopedRateLimitKey('remote_pair_claim_code', codeRateValue),
        limit: PAIRING_CODE_ATTEMPTS_PER_WINDOW,
      },
      {
        scope: 'remote_pair_claim_ip',
        keyHash: hashRateLimitRequestIp(request, 'remote_pair_claim_ip'),
        limit: PAIRING_IP_ATTEMPTS_PER_WINDOW,
      },
    ],
  });
  if (claimQuota.limited) {
    return jsonResponse(
      { error: 'pairing_rate_limited', message: 'Too many pairing attempts. Try again later.' },
      {
        status: 429,
        headers: {
          ...noStore,
          'Retry-After': String(claimQuota.retryAfterSeconds),
        },
      },
      request,
    );
  }

  const device = normalizePairingDeviceInput(body);
  const codeHash = normalizedCode ? hashPairingCode(normalizedCode) : null;
  if (!device || !codeHash) {
    return jsonResponse(
      { error: 'invalid_pairing', message: 'The pairing code or device details are invalid.' },
      { status: 400, headers: noStore },
      request,
    );
  }

  const now = new Date();
  const [consumed] = await db
    .update(remotePairingCodes)
    .set({ consumedAt: now, consumedByDeviceId: device.deviceId })
    .where(and(
      eq(remotePairingCodes.codeHash, codeHash),
      isNull(remotePairingCodes.consumedAt),
      isNull(remotePairingCodes.revokedAt),
      gt(remotePairingCodes.expiresAt, now),
      ne(remotePairingCodes.issuerDeviceId, device.deviceId),
    ))
    .returning({
      id: remotePairingCodes.id,
      userId: remotePairingCodes.userId,
      issuerDeviceId: remotePairingCodes.issuerDeviceId,
    });

  if (!consumed) {
    return jsonResponse(
      { error: 'invalid_pairing', message: 'The pairing code is invalid, expired, consumed, or revoked.' },
      { status: 400, headers: noStore },
      request,
    );
  }

  const token = createRemoteDeviceToken();
  const tokenHash = hashRemoteDeviceToken(token);
  if (!tokenHash) {
    return jsonResponse({ error: 'pairing_failed', message: 'Could not authorize this device.' }, { status: 500 }, request);
  }

  const expiresAt = new Date(now.getTime() + SPICE_CONNECT_DEVICE_AUTH_TTL_MS);
  const [authorization] = await db
    .insert(remoteDeviceAuthorizations)
    .values({
      userId: consumed.userId,
      issuerDeviceId: consumed.issuerDeviceId,
      deviceId: device.deviceId,
      displayName: device.displayName,
      tokenHash,
      createdAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [remoteDeviceAuthorizations.userId, remoteDeviceAuthorizations.deviceId],
      set: {
        issuerDeviceId: consumed.issuerDeviceId,
        displayName: device.displayName,
        tokenHash,
        createdAt: now,
        expiresAt,
        lastUsedAt: null,
        revokedAt: null,
      },
    })
    .returning({ id: remoteDeviceAuthorizations.id });

  await db
    .insert(remoteDevices)
    .values({
      userId: consumed.userId,
      deviceId: device.deviceId,
      displayName: device.displayName,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [remoteDevices.userId, remoteDevices.deviceId],
      set: { displayName: device.displayName, updatedAt: now },
    });

  return jsonResponse({
    authorizationId: authorization.id,
    userId: consumed.userId,
    accessToken: token,
    tokenType: 'Bearer',
    scope: 'spice_connect',
    expiresAt: expiresAt.toISOString(),
    device,
  }, { status: 201, headers: noStore }, request);
}
